import Book from "../models/book.js";
import Member from "../models/member.js";
import Borrowing from "../models/borrowing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Validate and read pagination parameters from the request query.
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

// GET /api/reports/inventory
// Optional query parameters: ?page=1&limit=10
export const getInventoryReport = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [totalTitles, inventoryTotals, books] = await Promise.all([
    Book.countDocuments({ isActive: true }),

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

    Book.find({ isActive: true })
      .select("title author category bookCode totalCopies availableCopies")
      .sort({ title: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const totals = inventoryTotals[0] ?? {
    totalCopies: 0,
    availableCopies: 0,
  };

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalTitles,
        totalCopies: totals.totalCopies,
        availableCopies: totals.availableCopies,
      },
      books,
      pagination: buildPagination(totalTitles, page, limit),
    },
  });
});

// GET /api/reports/overdue
// Optional query parameters: ?page=1&limit=10
export const getOverdueReport = asyncHandler(async (req, res) => {
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
      .populate("issuedBy", "name email")
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

// GET /api/reports/borrowings
// Optional query parameters:
// ?page=1&limit=10
// ?status=borrowed
// ?status=returned
export const getBorrowingHistoryReport = asyncHandler(async (req, res) => {
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

  const [total, borrowings] = await Promise.all([
    Borrowing.countDocuments(filter),

    Borrowing.find(filter)
      .populate("member", "firstName lastName membershipNumber")
      .populate("book", "title author bookCode")
      .populate("issuedBy", "name email")
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

// GET /api/reports/members
// Optional query parameters: ?page=1&limit=10
export const getMemberActivityReport = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [totalMembers, members] = await Promise.all([
    Member.countDocuments(),

    Member.find()
      .select("firstName lastName membershipNumber status registeredAt")
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  // Calculate activity only for the members on this page.
  const memberIds = members.map((member) => member._id);

  const activity = memberIds.length
    ? await Borrowing.aggregate([
        {
          $match: {
            member: { $in: memberIds },
          },
        },
        {
          $group: {
            _id: "$member",
            totalBorrowings: { $sum: 1 },
            currentBorrowings: {
              $sum: {
                $cond: [{ $eq: ["$status", "borrowed"] }, 1, 0],
              },
            },
            returnedBorrowings: {
              $sum: {
                $cond: [{ $eq: ["$status", "returned"] }, 1, 0],
              },
            },
          },
        },
      ])
    : [];

  const activityByMember = new Map(
    activity.map((item) => [String(item._id), item]),
  );

  const report = members.map((member) => {
    const stats = activityByMember.get(String(member._id));

    return {
      ...member,
      activity: {
        totalBorrowings: stats?.totalBorrowings ?? 0,
        currentBorrowings: stats?.currentBorrowings ?? 0,
        returnedBorrowings: stats?.returnedBorrowings ?? 0,
      },
    };
  });

  res.status(200).json({
    success: true,
    data: {
      totalMembers,
      members: report,
      pagination: buildPagination(totalMembers, page, limit),
    },
  });
});

// GET /api/reports/returns
// Optional query parameters: ?page=1&limit=10
export const getReturnsReport = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = { status: "returned" };

  const [totalReturns, returns] = await Promise.all([
    Borrowing.countDocuments(filter),

    Borrowing.find(filter)
      .populate("member", "firstName lastName membershipNumber")
      .populate("book", "title author bookCode")
      .populate("issuedBy", "name email")
      .sort({ returnedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalReturns,
      returns,
      pagination: buildPagination(totalReturns, page, limit),
      generatedAt: new Date(),
    },
  });
});
