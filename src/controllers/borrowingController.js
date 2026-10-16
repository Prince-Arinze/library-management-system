import Book from "../models/book.js";
import Member from "../models/member.js";
import Borrowing from "../models/borrowing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

export const issueBook = asyncHandler(async (req, res) => {
  const { memberId, bookId, dueDate } = req.body ?? {};

  if (!memberId || !bookId || !dueDate) {
    throw httpError(400, "memberId, bookId, and dueDate are required.");
  }

  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  if (
    typeof memberId !== "string" ||
    !objectIdPattern.test(memberId) ||
    typeof bookId !== "string" ||
    !objectIdPattern.test(bookId)
  ) {
    throw httpError(400, "Invalid memberId or bookId format.");
  }

  const parsedDueDate = new Date(dueDate);
  if (typeof dueDate !== "string" || Number.isNaN(parsedDueDate.getTime())) {
    throw httpError(400, "Invalid dueDate format.");
  }

  if (parsedDueDate <= new Date()) {
    throw httpError(400, "dueDate must be a future date.");
  }

  const member = await Member.findById(memberId);
  if (!member) {
    throw httpError(404, "Member not found.");
  }
  if (member.status !== "active") {
    throw httpError(400, "Member is inactive and cannot borrow books.");
  }

  const updatedBook = await Book.findOneAndUpdate(
    { _id: bookId, isActive: true, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true }
  );

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

  let borrowing;
  try {
    borrowing = await Borrowing.create({
      member: member._id,
      book: updatedBook._id,
      issuedBy: req.user._id,
      dueDate: parsedDueDate,
    });
  } catch (error) {
    await Book.updateOne(
      { _id: updatedBook._id },
      { $inc: { availableCopies: 1 } },
    );
    throw error;
  }

  res.status(201).json({
    success: true,
    data: borrowing,
  });
});

export const returnBook = asyncHandler(async (req, res) => {
  const returnedAt = new Date();
  const borrowing = await Borrowing.findOneAndUpdate(
    { _id: req.params.id, status: "borrowed" },
    { $set: { status: "returned", returnedAt } },
    { new: true },
  );

  if (!borrowing) {
    const existingBorrowing = await Borrowing.findById(req.params.id);
    if (!existingBorrowing) throw httpError(404, "Borrowing not found.");
    throw httpError(400, "This borrowing has already been returned.");
  }

  const rollbackReturn = () => Borrowing.updateOne(
    { _id: borrowing._id, status: "returned", returnedAt },
    { $set: { status: "borrowed", returnedAt: null } },
  );

  let book;
  try {
    book = await Book.findOneAndUpdate(
      {
        _id: borrowing.book,
        $expr: { $lt: ["$availableCopies", "$totalCopies"] },
      },
      { $inc: { availableCopies: 1 } },
      { new: true },
    );
  } catch (error) {
    await rollbackReturn();
    throw error;
  }

  if (!book) {
    await rollbackReturn();
    const existingBook = await Book.exists({ _id: borrowing.book });
    if (!existingBook) throw httpError(404, "Book not found.");
    throw httpError(409, "Available copies already equal total copies.");
  }

  return res.status(200).json({
    success: true,
    data: borrowing,
  });
});
