import Member from "../models/member.js";
import Borrowing from "../models/borrowing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

export const registerMember = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, address } = req.body;
  if (!firstName || !lastName)
    throw httpError(400, "First name and last name are required");

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
  if (!member) throw httpError(404, "Member not found");
  res.json({ success: true, data: member });
});

// Listing of borrowed book
export const listOfBorrowedBooks = asyncHandler(async (req, res) => {
  const memberId = req.user?.memberId;

  if (!memberId) {
    throw httpError(401, "Member authentication is required");
  }

  const borrowings = await Borrowing.find({
    member: memberId,
  })
    .populate("book", "title author")
    .sort({ createdAt: -1 });

  if (borrowings.length === 0) {
    throw httpError(404, "No borrowed books found for this member");
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
    throw httpError(401, "Member authentication is required");
  }

  const member = await Member.findById(memberId);

  if (!member) {
    throw httpError(404, "Member account not found");
  }

  await Member.findByIdAndDelete(memberId);

  res.status(200).json({
    success: true,
    message: "Your account has been deleted successfully",
  });
});

// update member profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, address } = req.body;
  const updateMemberDetails = { firstName, lastName, email, phone, address };

  const member = await Member.findByIdAndUpdate(
    req.user.id,
    updateMemberDetails,
    { new: true, runValidators: true },
  );
  res.status(200).json({
    success: true,
    message: "Profile Udated successfully",
    member
  })
});
