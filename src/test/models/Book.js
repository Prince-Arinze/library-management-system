import mongoose from "mongoose";

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  author: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  publisher: { type: String, trim: true },
  isbn: { type: String, trim: true, sparse: true, unique: true },
  bookCode: { type: String, required: true, trim: true, unique: true },
  totalCopies: { type: Number, required: true, min: 0, validate: Number.isInteger },
  availableCopies: { type: Number, required: true, min: 0, validate: Number.isInteger },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

bookSchema.pre("validate", function (next) {
  if (this.availableCopies > this.totalCopies) {
    this.invalidate("availableCopies", "Available copies cannot exceed total copies.");
  }
  next();
});

export default mongoose.model("Book", bookSchema);