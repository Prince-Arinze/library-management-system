import mongoose from "mongoose";
import Book from "../models/book.js";
import Member from "../models/Member.js";
import Borrowing from "../models/Borrowing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

// POST /api/borrowings
export const issueBook = asyncHandler(async (req, res) => {
  const { memberId, bookId, dueDate } = req.body;

  // 1. Input Validation
  if (!memberId || !bookId || !dueDate) {
    throw httpError(400, "memberId, bookId, and dueDate are required.");
  }

  if (!mongoose.Types.ObjectId.isValid(memberId) || !mongoose.Types.ObjectId.isValid(bookId)) {
    throw httpError(400, "Invalid memberId or bookId format.");
  }

  const parsedDueDate = new Date(dueDate);
  if (isNaN(parsedDueDate.getTime())) {
    throw httpError(400, "Invalid dueDate format.");
  }
  
  if (parsedDueDate <= new Date()) {
    throw httpError(400, "dueDate must be a future date.");
  }

  // 2. Member Eligibility Check
  const member = await Member.findById(memberId);
  if (!member) {
    throw httpError(404, "Member not found.");
  }
  if (member.status !== "active") {
    throw httpError(400, "Member is inactive and cannot borrow books.");
  }

  // 3. Safe Copy-Count Update (Atomic Operation)

  const updatedBook = await Book.findOneAndUpdate(
    { _id: bookId, isActive: true, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true }
  );

  // If the atomic update fails, we check why to give the user a specific error message
  if (!updatedBook) {
    const book = await Book.findById(bookId);
    if (!book) {
      throw httpError(404, "Book not found.");
    }
    if (!book.isActive) {
      throw httpError(400, "This book is currently inactive and cannot be issued.");
    }
    throw httpError(400, "No copies of this book are currently available.");
  }

  // 4. Create Borrowing Record
  const issuedBy = req.user?._id || new mongoose.Types.ObjectId(); 

  const borrowing = await Borrowing.create({
    member: member._id,
    book: updatedBook._id,
    issuedBy,
    dueDate: parsedDueDate,
  });

  res.status(201).json({
    success: true,
    data: borrowing,
  });
});