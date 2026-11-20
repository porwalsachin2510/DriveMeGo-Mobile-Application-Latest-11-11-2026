import mongoose from "mongoose"

// JOIN: one tap to enter. ANSWER: the commuter must answer `question`.
// QUIZ: multiple choice; only entries matching `correctOption` are eligible to win.
export const CONTEST_ENTRY_TYPES = ["JOIN", "ANSWER", "QUIZ"]

const contestSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 160 },
        description: { type: String, trim: true, maxlength: 2000 },
        prize: { type: String, trim: true, maxlength: 200 },
        rules: [{ type: String, trim: true }],
        terms: { type: String, trim: true, maxlength: 4000 },
        coverImage: { type: String, trim: true },
        startsAt: { type: Date, required: true },
        endsAt: { type: Date, required: true },
        maxWinners: { type: Number, default: 1, min: 1, max: 1000 },
        maxEntries: { type: Number, min: 1 },
        entryType: { type: String, enum: CONTEST_ENTRY_TYPES, default: "JOIN" },
        question: { type: String, trim: true, maxlength: 500 },
        options: [{ type: String, trim: true, maxlength: 200 }],
        correctOption: { type: Number, min: 0 },
        isActive: { type: Boolean, default: true, index: true },
        isFeatured: { type: Boolean, default: false },
        notifiedAt: { type: Date },
        winnersAnnouncedAt: { type: Date },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
)

contestSchema.pre("validate", function validateWindow(next) {
    if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
        this.invalidate("endsAt", "End date must be after the start date")
    }
    if (this.entryType === "ANSWER" && !this.question) this.invalidate("question", "A question is required")
    if (this.entryType === "QUIZ") {
        if (!this.question) this.invalidate("question", "A quiz question is required")
        if ((this.options || []).filter(Boolean).length < 2) this.invalidate("options", "Add at least two options")
        if (this.correctOption == null || this.correctOption >= (this.options || []).length) {
            this.invalidate("correctOption", "Choose the correct option")
        }
    }
    next()
})

export const Contest = mongoose.models.Contest || mongoose.model("Contest", contestSchema)

const contestEntrySchema = new mongoose.Schema(
    {
        contest: { type: mongoose.Schema.Types.ObjectId, ref: "Contest", required: true, index: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        answer: { type: String, trim: true, maxlength: 500 },
        selectedOption: { type: Number, min: 0 },
        isCorrect: { type: Boolean },
        status: { type: String, enum: ["ENTERED", "WINNER", "DISQUALIFIED"], default: "ENTERED" },
    },
    { timestamps: true },
)

contestEntrySchema.index({ contest: 1, user: 1 }, { unique: true })

export const ContestEntry = mongoose.models.ContestEntry || mongoose.model("ContestEntry", contestEntrySchema)

export default Contest
