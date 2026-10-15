import Member from "../models/member.js";
import Borrowing from "../models/borrowing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

export const registerMember = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, address } = req.body;
  if (!firstName || !lastName)
    throw new httpError("First name and last name are required", 400);

  const member = await Member.create({
    firstName,
    lastName,
    email,
    phone,
    address,
  });
  res.status(201).json({
    success: true,
    message: "Member registered succefully.",
    data: member,
  });
});

// Getting a single member
export const getSingleMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw new httpError("Member not found", 404);
  res.json({ success: true, data: member });
});

// Listing of borrowed book
export const listOfBorrowedBooks = asyncHandler(async (req, res) => {
  const memberId = req.user?.memberId;

  if (!memberId) {
    throw new httpError("Member authentication is required", 401);
  }

  const borrowings = await Borrowing.find({
    member: memberId,
  })
    .populate("book", "title author")
    .sort({ createdAt: -1 });

  if (borrowings.length === 0) {
    throw new httpError("No borrowed books found for this member", 404);
  }

  res.status(200).json({
    success: true,
    count: borrowings.length,
    data: borrowings,
  });
});

// delete member account
export const deleteMyAccount = asyncHandler(async (req, res) => {
  const memberId = req.user?.memberId;

  if (!memberId) {
    throw new httpError("Authentication required", 401);
  }

  const member = await Member.findById(memberId);

  if (!member) {
    throw new httpError("Member account not found", 404);
  }

  await Member.findByIdAndDelete(memberId);

  res.status(200).json({
    success: true,
    message: "Your account has been deleted successfully",
  });
});
