import crypto from "crypto"
import mongoose from "mongoose"
import User from "../models/User.js"
import EmergencyContact from "../models/EmergencyContact.js"
import Feedback, { FEEDBACK_CATEGORIES } from "../models/Feedback.js"
import Faq from "../models/Faq.js"
import BlogPost, { POST_CATEGORIES, computeReadMinutes } from "../models/BlogPost.js"
import PostComment from "../models/PostComment.js"
import { Contest, ContestEntry } from "../models/Contest.js"
import Referral from "../models/Referral.js"
import TripProtection from "../models/TripProtection.js"
import B2CPassengerBooking from "../models/B2CPassengerBooking.js"
import { COUNTRY_CONFIG, COUNTRY_LOCATIONS } from "../Config/localizationConfig.js"
import { debitWallet, resolveUserWalletRole } from "../Services/walletService.js"
import { createNotification } from "../Services/notificationService.js"
import { uploadToCloudinary } from "../Config/Cloudinary.js"

const MAX_EMERGENCY_CONTACTS = 5
const PHONE_RULE = /^[+]?[\d\s\-()]{7,16}$/
const isId = (value) => mongoose.Types.ObjectId.isValid(value)

const fail = (res, status, message) => res.status(status).json({ success: false, message })
const serverError = (res, label, error) => {
    console.error(`[engagement] ${label}:`, error)
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." })
}
const pageParams = (query, defaultLimit = 20) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 50)
    return { page, limit, skip: (page - 1) * limit }
}

/* ------------------------------------------------------------------ */
/* City selection                                                      */
/* ------------------------------------------------------------------ */

// A commuter's country is detected from their real location and is
// deliberately not user-editable; only the city inside it can be switched.
export const getCityPreference = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("country preferredCity").lean()
        if (!user) return fail(res, 404, "User not found")
        const country = user.country || "UAE"
        const config = COUNTRY_CONFIG[country]
        res.json({
            success: true,
            data: {
                country,
                countryName: config?.displayName || country,
                cities: COUNTRY_LOCATIONS[country] || [],
                selected: user.preferredCity || null,
            },
        })
    } catch (error) {
        serverError(res, "getCityPreference", error)
    }
}

export const setCityPreference = async (req, res) => {
    try {
        const city = String(req.body?.city || "").trim()
        const user = await User.findById(req.userId).select("country")
        if (!user) return fail(res, 404, "User not found")
        const country = user.country || "UAE"
        const allowed = COUNTRY_LOCATIONS[country] || []
        const match = allowed.find((c) => c.toLowerCase() === city.toLowerCase())
        if (!match) return fail(res, 400, `Choose a city in ${COUNTRY_CONFIG[country]?.displayName || country}`)
        user.preferredCity = match
        await user.save({ validateModifiedOnly: true })
        res.json({ success: true, message: "City updated", data: { country, selected: match } })
    } catch (error) {
        serverError(res, "setCityPreference", error)
    }
}

/* ------------------------------------------------------------------ */
/* Emergency contacts                                                  */
/* ------------------------------------------------------------------ */

export const listEmergencyContacts = async (req, res) => {
    try {
        const contacts = await EmergencyContact.find({ user: req.userId }).sort({ isPrimary: -1, createdAt: 1 }).lean()
        res.json({ success: true, data: { contacts, max: MAX_EMERGENCY_CONTACTS } })
    } catch (error) {
        serverError(res, "listEmergencyContacts", error)
    }
}

export const createEmergencyContact = async (req, res) => {
    try {
        const { name, phone, relationship, isPrimary, notifyOnTrip } = req.body || {}
        if (!name?.trim()) return fail(res, 400, "Contact name is required")
        if (!PHONE_RULE.test(String(phone || "").trim())) return fail(res, 400, "Enter a valid phone number")

        const count = await EmergencyContact.countDocuments({ user: req.userId })
        if (count >= MAX_EMERGENCY_CONTACTS) {
            return fail(res, 400, `You can save up to ${MAX_EMERGENCY_CONTACTS} emergency contacts`)
        }
        const makePrimary = count === 0 || !!isPrimary
        if (makePrimary) await EmergencyContact.updateMany({ user: req.userId }, { $set: { isPrimary: false } })

        const contact = await EmergencyContact.create({
            user: req.userId,
            name: name.trim(),
            phone: String(phone).trim(),
            relationship: relationship?.trim() || "Family",
            isPrimary: makePrimary,
            notifyOnTrip: notifyOnTrip !== false,
        })
        res.status(201).json({ success: true, message: "Contact saved", data: { contact } })
    } catch (error) {
        if (error?.code === 11000) return fail(res, 409, "This number is already in your emergency contacts")
        serverError(res, "createEmergencyContact", error)
    }
}

export const updateEmergencyContact = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid contact id")
        const contact = await EmergencyContact.findOne({ _id: req.params.id, user: req.userId })
        if (!contact) return fail(res, 404, "Contact not found")

        const { name, phone, relationship, isPrimary, notifyOnTrip } = req.body || {}
        if (name !== undefined) {
            if (!String(name).trim()) return fail(res, 400, "Contact name is required")
            contact.name = String(name).trim()
        }
        if (phone !== undefined) {
            if (!PHONE_RULE.test(String(phone).trim())) return fail(res, 400, "Enter a valid phone number")
            contact.phone = String(phone).trim()
        }
        if (relationship !== undefined) contact.relationship = String(relationship).trim() || "Family"
        if (notifyOnTrip !== undefined) contact.notifyOnTrip = !!notifyOnTrip
        if (isPrimary === true && !contact.isPrimary) {
            await EmergencyContact.updateMany({ user: req.userId }, { $set: { isPrimary: false } })
            contact.isPrimary = true
        }
        await contact.save()
        res.json({ success: true, message: "Contact updated", data: { contact } })
    } catch (error) {
        if (error?.code === 11000) return fail(res, 409, "This number is already in your emergency contacts")
        serverError(res, "updateEmergencyContact", error)
    }
}

export const deleteEmergencyContact = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid contact id")
        const removed = await EmergencyContact.findOneAndDelete({ _id: req.params.id, user: req.userId })
        if (!removed) return fail(res, 404, "Contact not found")
        if (removed.isPrimary) {
            const next = await EmergencyContact.findOne({ user: req.userId }).sort({ createdAt: 1 })
            if (next) await EmergencyContact.updateOne({ _id: next._id }, { $set: { isPrimary: true } })
        }
        res.json({ success: true, message: "Contact removed" })
    } catch (error) {
        serverError(res, "deleteEmergencyContact", error)
    }
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export const submitFeedback = async (req, res) => {
    try {
        const { category, rating, subject, message } = req.body || {}
        const stars = Number(rating)
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) return fail(res, 400, "Please choose a rating from 1 to 5")
        if (!String(subject || "").trim()) return fail(res, 400, "Subject is required")
        if (String(message || "").trim().length < 10) return fail(res, 400, "Please write at least 10 characters")
        const cat = String(category || "GENERAL").toUpperCase()
        if (!FEEDBACK_CATEGORIES.includes(cat)) return fail(res, 400, "Invalid feedback category")

        const feedback = await Feedback.create({
            user: req.userId,
            role: req.userRole,
            category: cat,
            rating: stars,
            subject: String(subject).trim(),
            message: String(message).trim(),
        })
        res.status(201).json({ success: true, message: "Thanks for your feedback", data: { feedback } })
    } catch (error) {
        serverError(res, "submitFeedback", error)
    }
}

export const myFeedback = async (req, res) => {
    try {
        const { page, limit, skip } = pageParams(req.query)
        const [items, total] = await Promise.all([
            Feedback.find({ user: req.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Feedback.countDocuments({ user: req.userId }),
        ])
        res.json({ success: true, data: { items, total, page, limit } })
    } catch (error) {
        serverError(res, "myFeedback", error)
    }
}

export const adminListFeedback = async (req, res) => {
    try {
        const { page, limit, skip } = pageParams(req.query)
        const filter = req.query.status ? { status: String(req.query.status).toUpperCase() } : {}
        const [items, total] = await Promise.all([
            Feedback.find(filter).populate("user", "fullName email role").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Feedback.countDocuments(filter),
        ])
        res.json({ success: true, data: { items, total, page, limit } })
    } catch (error) {
        serverError(res, "adminListFeedback", error)
    }
}

export const adminRespondFeedback = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid feedback id")
        const { status, adminResponse } = req.body || {}
        const update = {}
        if (status) update.status = String(status).toUpperCase()
        if (adminResponse !== undefined) {
            update.adminResponse = adminResponse
            update.respondedAt = new Date()
        }
        const item = await Feedback.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
        if (!item) return fail(res, 404, "Feedback not found")
        res.json({ success: true, data: { feedback: item } })
    } catch (error) {
        serverError(res, "adminRespondFeedback", error)
    }
}

/* ------------------------------------------------------------------ */
/* FAQs                                                                */
/* ------------------------------------------------------------------ */

export const listFaqs = async (req, res) => {
    try {
        const filter = { isActive: true }
        if (req.query.category && req.query.category !== "All") filter.category = String(req.query.category)
        if (req.query.q) {
            const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
            filter.$or = [{ question: rx }, { answer: rx }]
        }
        const faqs = await Faq.find(filter).sort({ category: 1, order: 1, createdAt: 1 }).lean()
        const categories = await Faq.distinct("category", { isActive: true })
        res.json({ success: true, data: { faqs, categories: categories.sort() } })
    } catch (error) {
        serverError(res, "listFaqs", error)
    }
}

export const adminListFaqs = async (req, res) => {
    try {
        const faqs = await Faq.find({}).sort({ category: 1, order: 1, createdAt: 1 }).lean()
        const categories = [...new Set(faqs.map((f) => f.category).filter(Boolean))].sort()
        res.json({ success: true, data: { faqs, categories } })
    } catch (error) {
        serverError(res, "adminListFaqs", error)
    }
}

export const adminCreateFaq = async (req, res) => {
    try {
        const faq = await Faq.create(req.body)
        res.status(201).json({ success: true, data: { faq } })
    } catch (error) {
        if (error?.name === "ValidationError") return fail(res, 400, error.message)
        serverError(res, "adminCreateFaq", error)
    }
}

export const adminUpdateFaq = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid FAQ id")
        const faq = await Faq.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true })
        if (!faq) return fail(res, 404, "FAQ not found")
        res.json({ success: true, data: { faq } })
    } catch (error) {
        if (error?.name === "ValidationError") return fail(res, 400, error.message)
        serverError(res, "adminUpdateFaq", error)
    }
}

export const adminDeleteFaq = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid FAQ id")
        const faq = await Faq.findByIdAndDelete(req.params.id)
        if (!faq) return fail(res, 404, "FAQ not found")
        res.json({ success: true, message: "FAQ deleted" })
    } catch (error) {
        serverError(res, "adminDeleteFaq", error)
    }
}

/* ------------------------------------------------------------------ */
/* News & blog                                                         */
/* ------------------------------------------------------------------ */

const slugify = (title) =>
    String(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const POST_EDITABLE = [
    "type", "category", "title", "slug", "excerpt", "content", "coverImage", "author",
    "tags", "isPublished", "isFeatured", "allowComments", "publishedAt",
]

const pickPostFields = (body = {}) => {
    const out = {}
    for (const key of POST_EDITABLE) if (body[key] !== undefined) out[key] = body[key]
    if (out.category) out.category = String(out.category).toUpperCase()
    if (out.type) out.type = String(out.type).toUpperCase()
    if (Array.isArray(out.tags)) out.tags = [...new Set(out.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 15)
    if (out.publishedAt === "" || out.publishedAt === null) delete out.publishedAt
    if (out.content !== undefined) out.readMinutes = computeReadMinutes(out.content)
    return out
}

// Per-user arrays are replaced with flags so user ids never leave the server.
const presentPost = (post, userId) => {
    const uid = String(userId || "")
    const { likes = [], bookmarks = [], ...rest } = post
    return {
        ...rest,
        likeCount: rest.likeCount ?? likes.length,
        liked: likes.some((id) => String(id) === uid),
        bookmarked: bookmarks.some((id) => String(id) === uid),
    }
}

const publicPostFilter = () => ({ isPublished: true, publishedAt: { $lte: new Date() } })

export const listPosts = async (req, res) => {
    try {
        const { page, limit, skip } = pageParams(req.query, 10)
        const filter = publicPostFilter()
        const type = String(req.query.type || "").toUpperCase()
        if (type === "NEWS" || type === "BLOG") filter.type = type
        const category = String(req.query.category || "").toUpperCase()
        if (POST_CATEGORIES.includes(category)) filter.category = category
        if (req.query.tag) filter.tags = String(req.query.tag).toLowerCase()
        if (req.query.featured === "true") filter.isFeatured = true
        if (req.query.saved === "true") filter.bookmarks = req.userId
        if (req.query.q) {
            const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), "i")
            filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }]
        }
        const [items, total] = await Promise.all([
            BlogPost.find(filter).select("-content").sort({ isFeatured: -1, publishedAt: -1 }).skip(skip).limit(limit).lean(),
            BlogPost.countDocuments(filter),
        ])
        res.json({
            success: true,
            data: {
                items: items.map((p) => presentPost(p, req.userId)),
                total,
                page,
                limit,
                hasMore: skip + items.length < total,
                categories: POST_CATEGORIES,
            },
        })
    } catch (error) {
        serverError(res, "listPosts", error)
    }
}

export const getPost = async (req, res) => {
    try {
        const key = req.params.idOrSlug
        const query = isId(key) ? { _id: key } : { slug: String(key).toLowerCase() }
        const post = await BlogPost.findOneAndUpdate({ ...query, ...publicPostFilter() }, { $inc: { views: 1 } }, { new: true }).lean()
        if (!post) return fail(res, 404, "Article not found")

        const related = await BlogPost.find({
            ...publicPostFilter(),
            _id: { $ne: post._id },
            $or: [{ category: post.category }, { tags: { $in: post.tags || [] } }, { type: post.type }],
        })
            .select("title slug excerpt coverImage type category publishedAt readMinutes")
            .sort({ publishedAt: -1 })
            .limit(4)
            .lean()

        res.json({ success: true, data: { post: presentPost(post, req.userId), related } })
    } catch (error) {
        serverError(res, "getPost", error)
    }
}

const togglePostArray = (field, countField) => async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid article id")
        const base = { _id: req.params.id, ...publicPostFilter() }
        const exists = await BlogPost.exists({ ...base, [field]: req.userId })
        // The array condition in each filter makes concurrent double-taps idempotent.
        const filter = exists ? { ...base, [field]: req.userId } : { ...base, [field]: { $ne: req.userId } }
        const update = exists ? { $pull: { [field]: req.userId } } : { $addToSet: { [field]: req.userId } }
        if (countField) update.$inc = { [countField]: exists ? -1 : 1 }
        await BlogPost.updateOne(filter, update)
        const post = await BlogPost.findOne(base).select(countField || "_id").lean()
        if (!post) return fail(res, 404, "Article not found")
        res.json({
            success: true,
            data: { active: !exists, count: countField ? Math.max(post[countField] || 0, 0) : undefined },
        })
    } catch (error) {
        serverError(res, `toggle ${field}`, error)
    }
}

export const togglePostLike = togglePostArray("likes", "likeCount")
export const togglePostBookmark = togglePostArray("bookmarks")

export const listPostComments = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid article id")
        const { page, limit, skip } = pageParams(req.query, 20)
        const filter = { post: req.params.id, status: "VISIBLE" }
        const [items, total] = await Promise.all([
            PostComment.find(filter).populate("user", "fullName profileImage").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            PostComment.countDocuments(filter),
        ])
        const uid = String(req.userId)
        res.json({
            success: true,
            data: {
                items: items.map((c) => ({ ...c, mine: String(c.user?._id || c.user) === uid })),
                total,
                page,
                hasMore: skip + items.length < total,
            },
        })
    } catch (error) {
        serverError(res, "listPostComments", error)
    }
}

export const addPostComment = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid article id")
        const body = String(req.body?.body || "").trim()
        if (body.length < 2) return fail(res, 400, "Write a comment first")
        if (body.length > 1000) return fail(res, 400, "Comments can be up to 1000 characters")
        const post = await BlogPost.findOne({ _id: req.params.id, ...publicPostFilter() }).select("allowComments").lean()
        if (!post) return fail(res, 404, "Article not found")
        if (post.allowComments === false) return fail(res, 403, "Comments are turned off for this article")

        const recent = await PostComment.countDocuments({ user: req.userId, createdAt: { $gte: new Date(Date.now() - 60_000) } })
        if (recent >= 5) return fail(res, 429, "You're commenting too fast. Please wait a moment.")

        const comment = await PostComment.create({ post: post._id, user: req.userId, body })
        await BlogPost.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } })
        const populated = await comment.populate("user", "fullName profileImage")
        res.status(201).json({ success: true, data: { comment: { ...populated.toObject(), mine: true } } })
    } catch (error) {
        if (error?.name === "ValidationError") return fail(res, 400, error.message)
        serverError(res, "addPostComment", error)
    }
}

export const deleteMyPostComment = async (req, res) => {
    try {
        if (!isId(req.params.commentId)) return fail(res, 400, "Invalid comment id")
        const comment = await PostComment.findOneAndDelete({ _id: req.params.commentId, user: req.userId })
        if (!comment) return fail(res, 404, "Comment not found")
        if (comment.status === "VISIBLE") await BlogPost.updateOne({ _id: comment.post }, { $inc: { commentCount: -1 } })
        res.json({ success: true, message: "Comment deleted" })
    } catch (error) {
        serverError(res, "deleteMyPostComment", error)
    }
}

export const adminListPosts = async (req, res) => {
    try {
        const { page, limit, skip } = pageParams(req.query, 15)
        const filter = {}
        const type = String(req.query.type || "").toUpperCase()
        if (type === "NEWS" || type === "BLOG") filter.type = type
        const category = String(req.query.category || "").toUpperCase()
        if (POST_CATEGORIES.includes(category)) filter.category = category
        const status = String(req.query.status || "").toLowerCase()
        if (status === "published") Object.assign(filter, { isPublished: true, publishedAt: { $lte: new Date() } })
        if (status === "scheduled") Object.assign(filter, { isPublished: true, publishedAt: { $gt: new Date() } })
        if (status === "draft") filter.isPublished = false
        if (req.query.q) {
            const rx = new RegExp(escapeRegex(req.query.q), "i")
            filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }, { author: rx }]
        }
        const [items, total, totals] = await Promise.all([
            BlogPost.find(filter).select("-content -likes -bookmarks").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            BlogPost.countDocuments(filter),
            BlogPost.aggregate([
                {
                    $group: {
                        _id: null,
                        posts: { $sum: 1 },
                        published: { $sum: { $cond: ["$isPublished", 1, 0] } },
                        views: { $sum: "$views" },
                        likes: { $sum: "$likeCount" },
                        comments: { $sum: "$commentCount" },
                    },
                },
            ]),
        ])
        res.json({
            success: true,
            data: {
                items,
                total,
                page,
                limit,
                hasMore: skip + items.length < total,
                categories: POST_CATEGORIES,
                stats: totals[0] || { posts: 0, published: 0, views: 0, likes: 0, comments: 0 },
            },
        })
    } catch (error) {
        serverError(res, "adminListPosts", error)
    }
}

export const adminGetPost = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid article id")
        const post = await BlogPost.findById(req.params.id).select("-likes -bookmarks").lean()
        if (!post) return fail(res, 404, "Article not found")
        res.json({ success: true, data: { post } })
    } catch (error) {
        serverError(res, "adminGetPost", error)
    }
}

const COMMUTER_FANOUT_LIMIT = 5000

const notifyCommuters = async (payload) => {
    const commuters = await User.find({ role: "COMMUTER", isActive: { $ne: false } })
        .select("_id")
        .limit(COMMUTER_FANOUT_LIMIT)
        .lean()
    await Promise.allSettled(commuters.map((u) => createNotification({ userId: u._id, ...payload })))
    return commuters.length
}

// Atomically claims `notifiedAt` so an article is announced at most once.
const maybeNotifyPost = async (post) => {
    if (!post.isPublished || post.publishedAt > new Date() || post.notifiedAt) return
    const claimed = await BlogPost.findOneAndUpdate(
        { _id: post._id, notifiedAt: { $exists: false } },
        { $set: { notifiedAt: new Date() } },
    )
    if (!claimed) return
    await notifyCommuters({
        type: post.type === "NEWS" ? "NEWS_PUBLISHED" : "BLOG_PUBLISHED",
        title: post.type === "NEWS" ? "Latest news" : "New on the blog",
        message: post.title,
        data: { postId: String(post._id), slug: post.slug, link: `/article/${post.slug}` },
    })
}

export const adminCreatePost = async (req, res) => {
    try {
        const body = pickPostFields(req.body)
        if (!body.title) return fail(res, 400, "Title is required")
        if (!body.content || !String(body.content).replace(/<[^>]*>/g, "").trim()) return fail(res, 400, "Content is required")
        body.slug = body.slug ? slugify(body.slug) : `${slugify(body.title)}-${Date.now().toString(36)}`
        body.createdBy = req.userId
        const post = await BlogPost.create(body)
        if (req.body?.notifyUsers) maybeNotifyPost(post).catch((e) => console.error("[engagement] notify failed:", e))
        res.status(201).json({ success: true, data: { post } })
    } catch (error) {
        if (error?.name === "ValidationError") return fail(res, 400, error.message)
        if (error?.code === 11000) return fail(res, 409, "An article with this slug already exists")
        serverError(res, "adminCreatePost", error)
    }
}

export const adminUpdatePost = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid article id")
        const changes = pickPostFields(req.body)
        if (changes.slug) changes.slug = slugify(changes.slug)
        const post = await BlogPost.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true })
        if (!post) return fail(res, 404, "Article not found")
        if (req.body?.notifyUsers) maybeNotifyPost(post).catch((e) => console.error("[engagement] notify failed:", e))
        res.json({ success: true, data: { post } })
    } catch (error) {
        if (error?.name === "ValidationError") return fail(res, 400, error.message)
        if (error?.code === 11000) return fail(res, 409, "An article with this slug already exists")
        serverError(res, "adminUpdatePost", error)
    }
}

export const adminDeletePost = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid article id")
        const post = await BlogPost.findByIdAndDelete(req.params.id)
        if (!post) return fail(res, 404, "Article not found")
        await PostComment.deleteMany({ post: post._id })
        res.json({ success: true, message: "Article deleted" })
    } catch (error) {
        serverError(res, "adminDeletePost", error)
    }
}

export const adminListComments = async (req, res) => {
    try {
        const { page, limit, skip } = pageParams(req.query, 20)
        const filter = {}
        if (req.query.postId && isId(req.query.postId)) filter.post = req.query.postId
        const status = String(req.query.status || "").toUpperCase()
        if (status === "VISIBLE" || status === "HIDDEN") filter.status = status
        if (req.query.q) filter.body = new RegExp(escapeRegex(req.query.q), "i")
        const [items, total] = await Promise.all([
            PostComment.find(filter)
                .populate("user", "fullName email")
                .populate("post", "title slug type")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PostComment.countDocuments(filter),
        ])
        res.json({ success: true, data: { items, total, page, hasMore: skip + items.length < total } })
    } catch (error) {
        serverError(res, "adminListComments", error)
    }
}

export const adminModerateComment = async (req, res) => {
    try {
        if (!isId(req.params.commentId)) return fail(res, 400, "Invalid comment id")
        const status = String(req.body?.status || "").toUpperCase()
        if (!["VISIBLE", "HIDDEN"].includes(status)) return fail(res, 400, "Status must be VISIBLE or HIDDEN")
        const comment = await PostComment.findById(req.params.commentId)
        if (!comment) return fail(res, 404, "Comment not found")
        if (comment.status !== status) {
            comment.status = status
            await comment.save()
            await BlogPost.updateOne({ _id: comment.post }, { $inc: { commentCount: status === "VISIBLE" ? 1 : -1 } })
        }
        res.json({ success: true, data: { comment } })
    } catch (error) {
        serverError(res, "adminModerateComment", error)
    }
}

export const adminDeleteComment = async (req, res) => {
    try {
        if (!isId(req.params.commentId)) return fail(res, 400, "Invalid comment id")
        const comment = await PostComment.findByIdAndDelete(req.params.commentId)
        if (!comment) return fail(res, 404, "Comment not found")
        if (comment.status === "VISIBLE") await BlogPost.updateOne({ _id: comment.post }, { $inc: { commentCount: -1 } })
        res.json({ success: true, message: "Comment deleted" })
    } catch (error) {
        serverError(res, "adminDeleteComment", error)
    }
}

/* ------------------------------------------------------------------ */
/* Contests                                                            */
/* ------------------------------------------------------------------ */

const contestPhase = (contest, now = new Date()) =>
    now < new Date(contest.startsAt) ? "UPCOMING" : now > new Date(contest.endsAt) ? "ENDED" : "LIVE"

const CONTEST_EDITABLE = [
    "title", "description", "prize", "rules", "terms", "coverImage", "startsAt", "endsAt", "maxWinners",
    "maxEntries", "entryType", "question", "options", "correctOption", "isActive", "isFeatured",
]

const pickContestFields = (body = {}) => {
    const out = {}
    for (const key of CONTEST_EDITABLE) if (body[key] !== undefined) out[key] = body[key]
    if (out.entryType) out.entryType = String(out.entryType).toUpperCase()
    if (Array.isArray(out.rules)) out.rules = out.rules.map((r) => String(r).trim()).filter(Boolean).slice(0, 20)
    if (Array.isArray(out.options)) out.options = out.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 6)
    if (out.maxEntries === "" || out.maxEntries === null) out.maxEntries = undefined
    if (out.correctOption === "" || out.correctOption === null) out.correctOption = undefined
    return out
}

// The quiz answer key and internal fields never reach commuters.
const presentContest = (contest, extra = {}) => {
    const { correctOption, createdBy, notifiedAt, ...rest } = contest
    return { ...rest, phase: contestPhase(contest), ...extra }
}

const presentEntry = (entry) =>
    entry ? { answer: entry.answer, selectedOption: entry.selectedOption, status: entry.status, joinedAt: entry.createdAt } : null

// Winners are shown publicly as "First L." only.
const winnersFor = async (contestIds) => {
    const winners = await ContestEntry.find({ contest: { $in: contestIds }, status: "WINNER" })
        .populate("user", "fullName")
        .select("contest user")
        .lean()
    const map = new Map()
    for (const w of winners) {
        const key = String(w.contest)
        const [first = "Winner", last = ""] = String(w.user?.fullName || "Winner").trim().split(/\s+/)
        map.set(key, [...(map.get(key) || []), last ? `${first} ${last[0]}.` : first])
    }
    return map
}

export const listContests = async (req, res) => {
    try {
        const status = String(req.query.status || "").toUpperCase()
        const contests = await Contest.find({ isActive: true }).sort({ endsAt: -1 }).limit(50).lean()
        const ids = contests.map((c) => c._id)
        const [mine, counts, winners] = await Promise.all([
            ContestEntry.find({ contest: { $in: ids }, user: req.userId }).lean(),
            ContestEntry.aggregate([{ $match: { contest: { $in: ids } } }, { $group: { _id: "$contest", n: { $sum: 1 } } }]),
            winnersFor(ids),
        ])
        const mineByContest = new Map(mine.map((e) => [String(e.contest), e]))
        const countByContest = new Map(counts.map((c) => [String(c._id), c.n]))

        let items = contests.map((c) => {
            const entry = mineByContest.get(String(c._id))
            return presentContest(c, {
                entries: countByContest.get(String(c._id)) || 0,
                joined: !!entry,
                myEntry: presentEntry(entry),
                won: entry?.status === "WINNER",
                winners: c.winnersAnnouncedAt ? winners.get(String(c._id)) || [] : [],
            })
        })
        if (["LIVE", "UPCOMING", "ENDED"].includes(status)) items = items.filter((c) => c.phase === status)
        if (status === "JOINED") items = items.filter((c) => c.joined)
        const order = { LIVE: 0, UPCOMING: 1, ENDED: 2 }
        items.sort((a, b) => order[a.phase] - order[b.phase] || Number(!!b.isFeatured) - Number(!!a.isFeatured))
        res.json({ success: true, data: { items } })
    } catch (error) {
        serverError(res, "listContests", error)
    }
}

export const getContest = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid contest id")
        const contest = await Contest.findOne({ _id: req.params.id, isActive: true }).lean()
        if (!contest) return fail(res, 404, "Contest not found")
        const [entry, entries, winners] = await Promise.all([
            ContestEntry.findOne({ contest: contest._id, user: req.userId }).lean(),
            ContestEntry.countDocuments({ contest: contest._id }),
            winnersFor([contest._id]),
        ])
        res.json({
            success: true,
            data: {
                contest: presentContest(contest, {
                    entries,
                    joined: !!entry,
                    myEntry: presentEntry(entry),
                    won: entry?.status === "WINNER",
                    winners: contest.winnersAnnouncedAt ? winners.get(String(contest._id)) || [] : [],
                }),
            },
        })
    } catch (error) {
        serverError(res, "getContest", error)
    }
}

export const joinContest = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid contest id")
        const contest = await Contest.findOne({ _id: req.params.id, isActive: true }).lean()
        if (!contest) return fail(res, 404, "Contest not found")
        const phase = contestPhase(contest)
        if (phase === "UPCOMING") return fail(res, 400, "This contest has not started yet")
        if (phase === "ENDED") return fail(res, 400, "This contest has ended")
        if (contest.maxEntries) {
            const count = await ContestEntry.countDocuments({ contest: contest._id })
            if (count >= contest.maxEntries) return fail(res, 400, "This contest is full")
        }

        const entryData = { contest: contest._id, user: req.userId }
        if (contest.entryType === "ANSWER") {
            const answer = String(req.body?.answer || "").trim()
            if (answer.length < 2) return fail(res, 400, "Please answer the question to enter")
            entryData.answer = answer.slice(0, 500)
        } else if (contest.entryType === "QUIZ") {
            const selected = Number(req.body?.selectedOption)
            if (!Number.isInteger(selected) || selected < 0 || selected >= (contest.options || []).length) {
                return fail(res, 400, "Pick an option to enter")
            }
            entryData.selectedOption = selected
            entryData.isCorrect = selected === contest.correctOption
        }

        const entry = await ContestEntry.create(entryData)
        res.status(201).json({ success: true, message: "You're in. Good luck!", data: { entry: presentEntry(entry) } })
    } catch (error) {
        if (error?.code === 11000) return fail(res, 409, "You have already joined this contest")
        serverError(res, "joinContest", error)
    }
}

export const adminListContests = async (req, res) => {
    try {
        const contests = await Contest.find({}).sort({ endsAt: -1 }).limit(200).lean()
        const ids = contests.map((c) => c._id)
        const counts = await ContestEntry.aggregate([
            { $match: { contest: { $in: ids } } },
            { $group: { _id: "$contest", n: { $sum: 1 }, winners: { $sum: { $cond: [{ $eq: ["$status", "WINNER"] }, 1, 0] } } } },
        ])
        const byContest = new Map(counts.map((c) => [String(c._id), c]))
        const items = contests.map((c) => ({
            ...c,
            phase: contestPhase(c),
            entries: byContest.get(String(c._id))?.n || 0,
            winnersPicked: byContest.get(String(c._id))?.winners || 0,
        }))
        const stats = {
            total: items.length,
            live: items.filter((c) => c.phase === "LIVE" && c.isActive).length,
            upcoming: items.filter((c) => c.phase === "UPCOMING" && c.isActive).length,
            entries: items.reduce((sum, c) => sum + c.entries, 0),
        }
        res.json({ success: true, data: { items, stats } })
    } catch (error) {
        serverError(res, "adminListContests", error)
    }
}

export const adminContestEntries = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid contest id")
        const entries = await ContestEntry.find({ contest: req.params.id })
            .populate("user", "fullName email phone")
            .sort({ status: -1, createdAt: -1 })
            .limit(2000)
            .lean()
        res.json({ success: true, data: { entries } })
    } catch (error) {
        serverError(res, "adminContestEntries", error)
    }
}

export const adminDeleteContest = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid contest id")
        const contest = await Contest.findByIdAndDelete(req.params.id)
        if (!contest) return fail(res, 404, "Contest not found")
        await ContestEntry.deleteMany({ contest: contest._id })
        res.json({ success: true, message: "Contest deleted" })
    } catch (error) {
        serverError(res, "adminDeleteContest", error)
    }
}

const maybeNotifyContest = async (contest) => {
    if (!contest.isActive || contest.notifiedAt || contestPhase(contest) === "ENDED") return
    const claimed = await Contest.findOneAndUpdate(
        { _id: contest._id, notifiedAt: { $exists: false } },
        { $set: { notifiedAt: new Date() } },
    )
    if (!claimed) return
    await notifyCommuters({
        type: "CONTEST_LAUNCHED",
        title: contestPhase(contest) === "LIVE" ? "New contest is live" : "Contest coming soon",
        message: contest.prize ? `${contest.title} - win ${contest.prize}` : contest.title,
        data: { contestId: String(contest._id), link: "/contests" },
    })
}

export const adminCreateContest = async (req, res) => {
    try {
        const body = pickContestFields(req.body)
        body.createdBy = req.userId
        const contest = await Contest.create(body)
        if (req.body?.notifyUsers) maybeNotifyContest(contest).catch((e) => console.error("[engagement] notify failed:", e))
        res.status(201).json({ success: true, data: { contest } })
    } catch (error) {
        if (error?.name === "ValidationError") return fail(res, 400, error.message)
        serverError(res, "adminCreateContest", error)
    }
}

export const adminUpdateContest = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid contest id")
        const contest = await Contest.findById(req.params.id)
        if (!contest) return fail(res, 404, "Contest not found")
        const entryCount = await ContestEntry.countDocuments({ contest: contest._id })
        const changes = pickContestFields(req.body)
        // Changing how people entered would invalidate entries already submitted.
        if (entryCount > 0) for (const locked of ["entryType", "options", "correctOption", "question"]) delete changes[locked]
        contest.set(changes)
        await contest.save()
        if (req.body?.notifyUsers) maybeNotifyContest(contest).catch((e) => console.error("[engagement] notify failed:", e))
        res.json({ success: true, data: { contest } })
    } catch (error) {
        if (error?.name === "ValidationError") return fail(res, 400, error.message)
        serverError(res, "adminUpdateContest", error)
    }
}

const announceWinners = async (contest, winnerUserIds) => {
    await Contest.updateOne({ _id: contest._id }, { $set: { winnersAnnouncedAt: new Date() } })
    await Promise.allSettled(
        winnerUserIds.map((userId) =>
            createNotification({
                userId,
                type: "CONTEST_WINNER",
                title: "You won!",
                message: contest.prize
                    ? `Congratulations! You won ${contest.prize} in "${contest.title}".`
                    : `Congratulations! You won "${contest.title}".`,
                data: { contestId: String(contest._id), link: "/contests" },
            }),
        ),
    )
}

export const adminPickContestWinners = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid contest id")
        const contest = await Contest.findById(req.params.id).lean()
        if (!contest) return fail(res, 404, "Contest not found")
        if (contestPhase(contest) !== "ENDED") return fail(res, 400, "Winners can only be picked after the contest ends")
        const existing = await ContestEntry.countDocuments({ contest: contest._id, status: "WINNER" })
        if (existing) return fail(res, 409, "Winners were already picked for this contest")

        const match = { contest: contest._id, status: "ENTERED" }
        if (contest.entryType === "QUIZ") match.isCorrect = true
        const winners = await ContestEntry.aggregate([{ $match: match }, { $sample: { size: contest.maxWinners || 1 } }])
        if (!winners.length) return fail(res, 400, "There are no eligible entries to pick from")
        await ContestEntry.updateMany({ _id: { $in: winners.map((w) => w._id) } }, { $set: { status: "WINNER" } })
        await announceWinners(contest, winners.map((w) => w.user))
        res.json({
            success: true,
            message: `${winners.length} winner(s) picked and notified`,
            data: { winners: winners.map((w) => w.user) },
        })
    } catch (error) {
        serverError(res, "adminPickContestWinners", error)
    }
}

// Lets admins judge ANSWER contests by hand, or disqualify an entry.
export const adminSetEntryStatus = async (req, res) => {
    try {
        if (!isId(req.params.id) || !isId(req.params.entryId)) return fail(res, 400, "Invalid id")
        const status = String(req.body?.status || "").toUpperCase()
        if (!["ENTERED", "WINNER", "DISQUALIFIED"].includes(status)) return fail(res, 400, "Invalid status")
        const contest = await Contest.findById(req.params.id).lean()
        if (!contest) return fail(res, 404, "Contest not found")
        const current = await ContestEntry.findOne({ _id: req.params.entryId, contest: contest._id }).lean()
        if (!current) return fail(res, 404, "Entry not found")
        if (status === "WINNER" && current.status !== "WINNER") {
            const winners = await ContestEntry.countDocuments({ contest: contest._id, status: "WINNER" })
            if (winners >= (contest.maxWinners || 1)) return fail(res, 400, `This contest allows ${contest.maxWinners || 1} winner(s)`)
        }
        const entry = await ContestEntry.findByIdAndUpdate(current._id, { $set: { status } }, { new: true }).populate(
            "user",
            "fullName email phone",
        )
        if (status === "WINNER" && current.status !== "WINNER") await announceWinners(contest, [entry.user._id])
        res.json({ success: true, data: { entry } })
    } catch (error) {
        serverError(res, "adminSetEntryStatus", error)
    }
}

/* ------------------------------------------------------------------ */
/* Cover image upload (admin)                                          */
/* ------------------------------------------------------------------ */

export const adminUploadCover = async (req, res) => {
    try {
        if (!req.file) return fail(res, 400, "Choose an image to upload")
        if (!req.file.mimetype?.startsWith("image/")) return fail(res, 400, "Only image files are allowed")
        const uploaded = await uploadToCloudinary(req.file, "driveme/engagement", "cover")
        const url = uploaded?.secure_url || uploaded?.url
        if (!url) return fail(res, 502, "Image upload failed. Please try again.")
        res.status(201).json({ success: true, data: { url } })
    } catch (error) {
        serverError(res, "adminUploadCover", error)
    }
}

/* ------------------------------------------------------------------ */
/* Referrals                                                           */
/* ------------------------------------------------------------------ */

const generateReferralCode = async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
        const code = `DMG${crypto.randomBytes(3).toString("hex").toUpperCase()}`
        if (!(await User.exists({ referralCode: code }))) return code
    }
    throw new Error("Could not allocate a unique referral code")
}

export const getMyReferrals = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("referralCode fullName")
        if (!user) return fail(res, 404, "User not found")
        if (!user.referralCode) {
            user.referralCode = await generateReferralCode()
            await user.save({ validateModifiedOnly: true })
        }
        const [referrals, referredBy] = await Promise.all([
            Referral.find({ referrer: req.userId }).populate("referee", "fullName").sort({ createdAt: -1 }).limit(100).lean(),
            Referral.findOne({ referee: req.userId }).populate("referrer", "fullName").lean(),
        ])
        res.json({
            success: true,
            data: {
                code: user.referralCode,
                total: referrals.length,
                referrals: referrals.map((r) => ({
                    _id: r._id,
                    name: r.referee?.fullName || "DriveMeGo user",
                    status: r.status,
                    joinedAt: r.createdAt,
                })),
                referredBy: referredBy ? { name: referredBy.referrer?.fullName || "A friend", code: referredBy.code } : null,
            },
        })
    } catch (error) {
        serverError(res, "getMyReferrals", error)
    }
}

const REFERRAL_WINDOW_DAYS = 30

export const applyReferralCode = async (req, res) => {
    try {
        const code = String(req.body?.code || "").trim().toUpperCase()
        if (!code) return fail(res, 400, "Enter a referral code")

        const me = await User.findById(req.userId).select("createdAt referralCode")
        if (!me) return fail(res, 404, "User not found")
        const ageDays = (Date.now() - new Date(me.createdAt).getTime()) / 86400000
        if (ageDays > REFERRAL_WINDOW_DAYS) {
            return fail(res, 400, `Referral codes can only be added within ${REFERRAL_WINDOW_DAYS} days of joining`)
        }
        if (await Referral.exists({ referee: req.userId })) return fail(res, 409, "You have already used a referral code")

        const referrer = await User.findOne({ referralCode: code }).select("_id")
        if (!referrer) return fail(res, 404, "That referral code does not exist")
        if (String(referrer._id) === String(req.userId)) return fail(res, 400, "You cannot use your own code")

        await Referral.create({ referrer: referrer._id, referee: req.userId, code })
        res.status(201).json({ success: true, message: "Referral code applied" })
    } catch (error) {
        if (error?.code === 11000) return fail(res, 409, "You have already used a referral code")
        serverError(res, "applyReferralCode", error)
    }
}

/* ------------------------------------------------------------------ */
/* Trip protection                                                     */
/* ------------------------------------------------------------------ */

export const PROTECTION_PLANS = [
    {
        id: "BASIC",
        name: "Basic Cover",
        premiumRate: 0.03,
        refundPercent: 50,
        perks: ["Claim up to 50% of the booking if you cannot travel", "Covers cancellation due to illness or emergency"],
    },
    {
        id: "PLUS",
        name: "Plus Cover",
        premiumRate: 0.06,
        refundPercent: 100,
        perks: ["Claim up to 100% of the booking if you cannot travel", "Covers illness, emergency and schedule changes"],
    },
]

const CURRENCY_DECIMALS = { KWD: 3, BHD: 3, OMR: 3 }
const roundMoney = (amount, currency) => {
    const f = 10 ** (CURRENCY_DECIMALS[currency] ?? 2)
    return Math.round(amount * f) / f
}

const ELIGIBLE_STATUSES = ["PENDING", "CONFIRMED", "ACCEPTED"]

export const getProtectionPlans = (req, res) => {
    res.json({ success: true, data: { plans: PROTECTION_PLANS } })
}

export const getProtectionOverview = async (req, res) => {
    try {
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const [protections, bookings] = await Promise.all([
            TripProtection.find({ user: req.userId, status: { $in: ["ACTIVE", "CLAIMED"] } })
                .populate("booking", "pickupLocation dropoffLocation travelDate passStartDate passEndDate paymentAmount currency")
                .sort({ createdAt: -1 })
                .lean(),
            B2CPassengerBooking.find({
                passengerId: req.userId,
                bookingStatus: { $in: ELIGIBLE_STATUSES },
                paymentStatus: { $ne: "FAILED" },
                $or: [{ travelDate: { $gte: startOfToday } }, { passEndDate: { $gte: now } }],
            })
                .select("pickupLocation dropoffLocation travelDate passStartDate passEndDate paymentAmount currency bookingStatus")
                .sort({ travelDate: 1 })
                .limit(30)
                .lean(),
        ])
        const protectedIds = new Set(protections.map((p) => String(p.booking?._id || p.booking)))
        res.json({
            success: true,
            data: {
                plans: PROTECTION_PLANS,
                protections,
                eligibleBookings: bookings
                    .filter((b) => !protectedIds.has(String(b._id)))
                    .map((b) => ({
                        ...b,
                        quotes: PROTECTION_PLANS.map((p) => ({
                            plan: p.id,
                            premium: roundMoney((b.paymentAmount || 0) * p.premiumRate, b.currency),
                        })),
                    })),
            },
        })
    } catch (error) {
        serverError(res, "getProtectionOverview", error)
    }
}

export const purchaseProtection = async (req, res) => {
    let draft = null
    try {
        const { bookingId, plan } = req.body || {}
        if (!isId(bookingId)) return fail(res, 400, "Choose a booking to protect")
        const planDef = PROTECTION_PLANS.find((p) => p.id === String(plan || "").toUpperCase())
        if (!planDef) return fail(res, 400, "Choose a protection plan")

        const booking = await B2CPassengerBooking.findOne({ _id: bookingId, passengerId: req.userId })
            .select("paymentAmount currency bookingStatus")
            .lean()
        if (!booking) return fail(res, 404, "Booking not found")
        if (!ELIGIBLE_STATUSES.includes(booking.bookingStatus)) return fail(res, 400, "This booking can no longer be protected")

        const premium = roundMoney((booking.paymentAmount || 0) * planDef.premiumRate, booking.currency)
        if (!(premium > 0)) return fail(res, 400, "This booking is not eligible for protection")

        draft = await TripProtection.create({
            user: req.userId,
            booking: booking._id,
            plan: planDef.id,
            premium,
            currency: booking.currency,
            refundPercent: planDef.refundPercent,
            status: "PENDING",
        })

        const role = await resolveUserWalletRole(req.userId, "COMMUTER")
        const debit = await debitWallet({
            userId: req.userId,
            role,
            amount: premium,
            currency: booking.currency,
            embeddedType: "TRANSFER",
            ledgerCategory: "BOOKING_PAYMENT",
            description: `${planDef.name} trip protection`,
            referenceId: draft._id,
            referenceModel: "TripProtection",
        })
        if (!debit.success) {
            await TripProtection.deleteOne({ _id: draft._id })
            return fail(res, 402, debit.message === "Insufficient balance" ? "Your wallet balance is too low to buy this cover" : debit.message || "Payment failed")
        }

        draft.status = "ACTIVE"
        await draft.save()
        res.status(201).json({ success: true, message: "Your trip is protected", data: { protection: draft } })
    } catch (error) {
        if (draft?._id && draft.status === "PENDING") await TripProtection.deleteOne({ _id: draft._id }).catch(() => {})
        if (error?.code === 11000) return fail(res, 409, "This booking is already protected")
        serverError(res, "purchaseProtection", error)
    }
}

export const claimProtection = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid protection id")
        const reason = String(req.body?.reason || "").trim()
        if (reason.length < 10) return fail(res, 400, "Please describe why you cannot travel (at least 10 characters)")
        const protection = await TripProtection.findOne({ _id: req.params.id, user: req.userId })
        if (!protection) return fail(res, 404, "Protection not found")
        if (protection.status !== "ACTIVE") return fail(res, 400, "A claim was already submitted for this booking")
        protection.status = "CLAIMED"
        protection.claim = { reason, status: "SUBMITTED", submittedAt: new Date() }
        await protection.save()
        res.json({ success: true, message: "Claim submitted. Our team will review it.", data: { protection } })
    } catch (error) {
        serverError(res, "claimProtection", error)
    }
}

export const adminDecideClaim = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, "Invalid protection id")
        const decision = String(req.body?.decision || "").toUpperCase()
        if (!["APPROVED", "REJECTED"].includes(decision)) return fail(res, 400, "Decision must be APPROVED or REJECTED")
        const protection = await TripProtection.findById(req.params.id)
        if (!protection || protection.claim?.status !== "SUBMITTED") return fail(res, 404, "No open claim found")
        protection.claim.status = decision
        protection.claim.decidedAt = new Date()
        protection.claim.adminNote = req.body?.adminNote
        await protection.save()
        res.json({ success: true, data: { protection } })
    } catch (error) {
        serverError(res, "adminDecideClaim", error)
    }
}
