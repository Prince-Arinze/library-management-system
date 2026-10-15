import Book from "../models/book.js";
import Borrowing from "../models/borrowing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

const allowedFields = [
    "title",
    "author",
    "category",
    "publisher",
    "isbn",
    "totalCopies",
    "availableCopies",
    "description",
];

export const createBook = asyncHandler(async (req, res) => {
  const data = {};

  for (const field of allowedFields) {
    if (req.body?.[field] !== undefined) {
      data[field] = req.body[field];
    }
  }

  if (data.availableCopies === undefined) {
    data.availableCopies = data.totalCopies;
  }

  const book = await Book.create(data);

  res.status(201).json({
    success: true,
    data: book,
  });
});

export const getBooks = asyncHandler(async (req, res) => {
  const { search, category, isActive, page = "1", limit = "10" } = req.query;

  const pageNumber = Number(page);
  const pageSize = Number(limit);

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw httpError(
      400,
      "Page must be a positive integer and limit must be between 1 and 100.",
    );
  }

  const filter = {};

  if (isActive !== undefined) {
    if (!["true", "false"].includes(isActive)) {
      throw httpError(400, "isActive must be true or false.");
    }

    filter.isActive = isActive === "true";
  }

  if (category) {
    const safeCategory = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.category = {
      $regex: safeCategory,
      $options: "i",
    };
  }

  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.$or = [
      { title: { $regex: safeSearch, $options: "i" } },
      { author: { $regex: safeSearch, $options: "i" } },
      { bookCode: { $regex: safeSearch, $options: "i" } },
      { isbn: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const skip = (pageNumber - 1) * pageSize;

  const [books, total] = await Promise.all([
    Book.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    Book.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: books,
    pagination: {
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

export const getBookById = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    throw httpError(404, "Book not found.");
  }

  res.status(200).json({
    success: true,
    data: book,
  });
});

export const updateBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    throw httpError(404, "Book not found.");
  }

  const updates = {};

  for (const field of allowedFields) {
    if (req.body?.[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  delete updates.availableCopies;

  const newTotal = updates.totalCopies;

  if (newTotal !== undefined) {
    if (
      typeof newTotal !== "number" ||
      !Number.isInteger(newTotal) ||
      newTotal < 0
    ) {
      throw httpError(400, "totalCopies must be a non-negative whole number.");
    }

    const activeBorrowings = await Borrowing.countDocuments({
      book: book._id,
      status: "borrowed",
    });

    if (newTotal < activeBorrowings) {
      throw httpError(
        400,
        "Total copies cannot be less than the number of books currently borrowed.",
      );
    }

    book.totalCopies = newTotal;
    book.availableCopies = newTotal - activeBorrowings;
  }

  for (const [field, value] of Object.entries(updates)) {
    if (field !== "totalCopies") {
      book[field] = value;
    }
  }

  await book.save();

  res.status(200).json({
    success: true,
    data: book,
  });
});

export const deactivateBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    throw httpError(404, "Book not found.");
  }

  if (!book.isActive) {
    throw httpError(400, "Book is already inactive.");
  }

  const activeBorrowings = await Borrowing.countDocuments({
    book: book._id,
    status: "borrowed",
  });

  if (activeBorrowings > 0) {
    throw httpError(
      400,
      "This book cannot be deactivated while copies are still borrowed.",
    );
  }

  book.isActive = false;
  await book.save();

    res.status(200).json({
        success: true,
        message: "Book deactivated successfully.",
        data: book,
    });
});
