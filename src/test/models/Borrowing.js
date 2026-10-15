import mongoose from "mongoose";

const borrowingSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  borrowedAt: { type: Date, default: Date.now, required: true },
  dueDate: {
    type: Date,
    required: true,
    validate: {
      validator(value) { return value > this.borrowedAt; },
      message: "Due date must be after the borrowing date."
    }
  },
  returnedAt: { type: Date, default: null },
  status: { type: String, enum: ["borrowed", "returned"], default: "borrowed", required: true }
}, { timestamps: true });

export default mongoose.model("Borrowing", borrowingSchema);