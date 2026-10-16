import Member from "../models/member.js";
import Borrowing from "../models/borrowing.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

export const registerMember = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, address } = req.body ?? {};
  if (
    typeof firstName !== "string" ||
    !firstName.trim() ||
    typeof lastName !== "string" ||
    !lastName.trim()
  ) {
    throw httpError(400, "First name and last name are required.");
  }

  const member = await Member.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email,
    phone,
    address,
  });
  return res.status(201).json({
    success: true,
    data: member,
  });
});

export const getSingleMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw httpError(404, "Member not found.");
  return res.status(200).json({ success: true, data: member });
});

export const listOfBorrowedBooks = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw httpError(404, "Member not found.");

  const borrowings = await Borrowing.find({
    member: member._id,
  })
    .populate("book", "title author")
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    count: borrowings.length,
    data: borrowings,
  });
});

export const updateMember = asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of ["firstName", "lastName", "email", "phone", "address"]) {
    if (req.body?.[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 0) {
    throw httpError(400, "Provide at least one member field to update.");
  }
  if (
    (updates.firstName !== undefined && typeof updates.firstName !== "string") ||
    (updates.lastName !== undefined && typeof updates.lastName !== "string")
  ) {
    throw httpError(400, "First name and last name must be strings.");
  }
  if (updates.firstName !== undefined) updates.firstName = updates.firstName.trim();
  if (updates.lastName !== undefined) updates.lastName = updates.lastName.trim();

  const member = await Member.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!member) throw httpError(404, "Member not found.");

  return res.status(200).json({ success: true, data: member });
});

export const deactivateMember = asyncHandler(async (req, res) => {
  const member = await Member.findByIdAndUpdate(
    req.params.id,
    { status: "inactive" },
    { new: true, runValidators: true },
  );
  if (!member) throw httpError(404, "Member not found.");

  return res.status(200).json({
    success: true,
    message: "Member deactivated successfully.",
    data: member,
  });
});
