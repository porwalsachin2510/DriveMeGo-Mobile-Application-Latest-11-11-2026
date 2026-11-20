import mongoose from "mongoose"

const postCommentSchema = new mongoose.Schema(
    {
        post: { type: mongoose.Schema.Types.ObjectId, ref: "BlogPost", required: true, index: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        body: { type: String, required: true, trim: true, maxlength: 1000 },
        status: { type: String, enum: ["VISIBLE", "HIDDEN"], default: "VISIBLE", index: true },
    },
    { timestamps: true },
)

postCommentSchema.index({ post: 1, status: 1, createdAt: -1 })

export default mongoose.models.PostComment || mongoose.model("PostComment", postCommentSchema)
