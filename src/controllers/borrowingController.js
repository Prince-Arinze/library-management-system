import mongoose from "mongoose";
import Book from "../models/book.js";
import Borrowing from "../models/borrowing.js";
import User from "../models/user.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function getPagination(query) {
  function parsePositiveInteger(value, name, defaultValue, maxValue) {
    if (value === undefined) {
      return defaultValue;
    }

    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
      throw httpError(400, `${name} must be a positive integer.`);
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed)) {
      throw httpError(400, `${name} is too large.`);
    }

    if (maxValue !== undefined && parsed > maxValue) {
      throw httpError(400, `${name} cannot exceed ${maxValue}.`);
    }

    return parsed;
  }

  const page = parsePositiveInteger(query.page, "page", DEFAULT_PAGE);

  const limit = parsePositiveInteger(
    query.limit,
    "limit",
    DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    throw httpError(400, "Requested page is too large.");
  }

  return { page, limit, skip };
}

function buildPagination(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

function validateObjectId(value, name) {
  if (typeof value !== "string" || !mongoose.Types.ObjectId.isValid(value)) {
    throw httpError(400, `Invalid ${name}.`);
  }
}

// PATCH /api/borrowings/:id/return
export const returnBook = asyncHandler(async (req, res) => {
  const { id } = req.params;

  validateObjectId(id, "borrowing ID");

  const returnedAt = new Date();

  // Only one concurrent request can change this record
  // from borrowed to returned.
  const borrowing = await Borrowing.findOneAndUpdate(
    {
      _id: id,
      status: "borrowed",
    },
    {
      $set: {
        status: "returned",
        returnedAt,
      },
    },

    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!borrowing) {
    const existingBorrowing = await Borrowing.findById(id);

    if (!existingBorrowing) {
      throw httpError(404, "Borrowing record not found.");
    }

    throw httpError(409, "This book has already been returned.");
  }

  // Restore exactly one copy, provided inventory is below
  // the book's registered total.
  try {
    const updatedBook = await Book.findOneAndUpdate(
      {
        _id: borrowing.book,
        $expr: {
          $lt: ["$availableCopies", "$totalCopies"],
        },
      },
      {
        $inc: {
          availableCopies: 1,
        },
      },

      {
        returnDocument: "after",
      },
    );

    if (!updatedBook) {
      // Roll back the borrowing status if inventory cannot
      // be restored, so a retry remains possible.
      await Borrowing.updateOne(
        {
          _id: borrowing._id,
          status: "returned",
          returnedAt,
        },
        {
          $set: {
            status: "borrowed",
            returnedAt: null,
          },
        },
      );

      throw httpError(
        409,
        "Could not restore inventory. Check the book record and copy counts.",
      );
    }
  } catch (error) {
    // Avoid leaving a returned record if the inventory update
    // itself fails with a database error.
    if (error.status !== 409) {
      await Borrowing.updateOne(
        {
          _id: borrowing._id,
          status: "returned",
          returnedAt,
        },
        {
          $set: {
            status: "borrowed",
            returnedAt: null,
          },
        },
      );
    }

    throw error;
  }

  const result = await Borrowing.findById(borrowing._id)
    .populate("member", "firstName lastName membershipNumber")
    .populate("book", "title author bookCode")
    .populate({
      path: "issuedBy",
      model: User,
      select: "name email",
    })
    .lean();

  res.status(200).json({
    success: true,
    message: "Book returned successfully.",
    data: result,
  });
});

// GET /api/borrowings
// Optional: ?status=borrowed&page=1&limit=10
// Optional: ?status=returned
// Optional: ?memberId=...&bookId=...
export const getBorrowingHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.query.status !== undefined) {
    if (
      typeof req.query.status !== "string" ||
      !["borrowed", "returned"].includes(req.query.status)
    ) {
      throw httpError(400, "Status must be borrowed or returned.");
    }

    filter.status = req.query.status;
  }

  if (req.query.memberId !== undefined) {
    validateObjectId(req.query.memberId, "memberId");
    filter.member = req.query.memberId;
  }

  if (req.query.bookId !== undefined) {
    validateObjectId(req.query.bookId, "bookId");
    filter.book = req.query.bookId;
  }

  const [total, borrowings] = await Promise.all([
    Borrowing.countDocuments(filter),

    Borrowing.find(filter)
      .populate("member", "firstName lastName membershipNumber")
      .populate("book", "title author bookCode")
      .populate({
        path: "issuedBy",
        model: User,
        select: "name email",
      })
      .sort({ borrowedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      total,
      borrowings,
      pagination: buildPagination(total, page, limit),
    },
  });
});

// GET /api/borrowings/overdue
// Optional: ?page=1&limit=10
export const getOverdueBorrowings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const now = new Date();

  const filter = {
    status: "borrowed",
    dueDate: { $lt: now },
  };

  const [totalOverdue, borrowings] = await Promise.all([
    Borrowing.countDocuments(filter),

    Borrowing.find(filter)
      .populate("member", "firstName lastName membershipNumber")
      .populate("book", "title author bookCode")
      .populate({
        path: "issuedBy",
        model: User,
        select: "name email",
      })
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalOverdue,
      borrowings,
      pagination: buildPagination(totalOverdue, page, limit),
      generatedAt: now,
    },
  });
});
