import mongoose from "mongoose";
import { randomBytes } from "node:crypto";

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    publisher: {
      type: String,
      trim: true,
    },
    isbn: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    bookCode: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      immutable: true,
    },
    totalCopies: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Total copies must be a whole number.",
      },
    },
    availableCopies: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Available copies must be a whole number.",
      },
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

bookSchema.pre("validate", function () {
  if (this.isNew) {
    this.bookCode = `BK-${randomBytes(6).toString("hex").toUpperCase()}`;
  }

  if (this.availableCopies > this.totalCopies) {
    this.invalidate(
      "availableCopies",
      "Available copies cannot exceed total copies.",
    );
  }
});

bookSchema.index({ isActive: 1, title: 1 }, { name: "isActive_title" });

const Book = mongoose.model("Book", bookSchema);

export default Book;
