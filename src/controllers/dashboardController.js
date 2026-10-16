import Book from "../models/book.js";
import Member from "../models/member.js";
import Borrowing from "../models/borrowing.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getDashboardSummary = asyncHandler(async (_req, res) => {
  const now = new Date();

  const [
    activeBookTitles,
    bookInventory,
    totalMembers,
    activeMembers,
    currentBorrowings,
    overdueBorrowings,
  ] = await Promise.all([
    // Count active book titles
    Book.countDocuments({ isActive: true }),

    // Calculate total and available copies
    Book.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalCopies: { $sum: "$totalCopies" },
          availableCopies: { $sum: "$availableCopies" },
        },
      },
    ]),

    // Count all registered members
    Member.countDocuments(),

    // Count active members
    Member.countDocuments({ status: "active" }),

    // Count books currently borrowed
    Borrowing.countDocuments({ status: "borrowed" }),

    // Count unreturned books past their due date
    Borrowing.countDocuments({
      status: "borrowed",
      dueDate: { $lt: now },
    }),
  ]);

  const inventory = bookInventory[0] ?? {
    totalCopies: 0,
    availableCopies: 0,
  };

  res.status(200).json({
    success: true,
    data: {
      books: {
        activeTitles: activeBookTitles,
        totalCopies: inventory.totalCopies,
        availableCopies: inventory.availableCopies,
      },
      members: {
        total: totalMembers,
        active: activeMembers,
      },
      borrowings: {
        current: currentBorrowings,
        overdue: overdueBorrowings,
      },
      generatedAt: now,
    },
  });
});
