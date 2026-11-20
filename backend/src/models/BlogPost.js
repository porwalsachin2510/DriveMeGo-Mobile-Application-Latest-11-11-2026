import mongoose from "mongoose"

export const POST_CATEGORIES = ["GENERAL", "ANNOUNCEMENT", "SAFETY", "TRAVEL_TIPS", "OFFERS", "COMMUNITY", "PRODUCT_UPDATE"]

const blogPostSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ["NEWS", "BLOG"], default: "BLOG", index: true },
        category: { type: String, enum: POST_CATEGORIES, default: "GENERAL", index: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
        excerpt: { type: String, trim: true, maxlength: 400 },
        content: { type: String, required: true },
        coverImage: { type: String, trim: true },
        author: { type: String, trim: true, default: "DriveMeGo Team" },
        tags: [{ type: String, trim: true, lowercase: true }],
        isPublished: { type: Boolean, default: true, index: true },
        isFeatured: { type: Boolean, default: false, index: true },
        allowComments: { type: Boolean, default: true },
        publishedAt: { type: Date, default: Date.now, index: true },
        readMinutes: { type: Number, default: 1, min: 1 },
        views: { type: Number, default: 0, min: 0 },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        likeCount: { type: Number, default: 0, min: 0 },
        bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        commentCount: { type: Number, default: 0, min: 0 },
        // Set once commuters receive a push/in-app notice, so we never notify twice.
        notifiedAt: { type: Date },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
)

blogPostSchema.index({ isPublished: 1, publishedAt: -1 })

// ~200 words per minute, HTML tags stripped.
export const computeReadMinutes = (content) => {
    const words = String(content || "")
        .replace(/<[^>]*>/g, " ")
        .split(/\s+/)
        .filter(Boolean).length
    return Math.max(1, Math.round(words / 200))
}

blogPostSchema.pre("save", function computeReadTime(next) {
    if (this.isModified("content")) this.readMinutes = computeReadMinutes(this.content)
    next()
})

export default mongoose.models.BlogPost || mongoose.model("BlogPost", blogPostSchema)
