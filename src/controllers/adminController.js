import User from "../models/userModel.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

const allowedRoles = ["admin", "librarian"];
const privilegedRoles = ["superAdmin", "admin"];

const toUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
});

const preventSelfLockout = (user, requesterId) => {
  if (user._id.toString() === requesterId.toString()) {
    throw httpError(400, "You cannot deactivate or change your own role.");
  }
};

const requireSuperAdminForPrivilegedUser = (user, requester) => {
  if (
    privilegedRoles.includes(user.role) &&
    requester.role !== "superAdmin" &&
    user._id.toString() !== requester._id.toString()
  ) {
    throw httpError(403, "Only a superAdmin can manage administrator accounts.");
  }
};

export const getUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  return res.status(200).json({
    success: true,
    count: users.length,
    data: users.map(toUserResponse),
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, "User not found.");

  return res.status(200).json({ success: true, data: toUserResponse(user) });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body ?? {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    throw httpError(400, "Name, email, and password are required.");
  }
  if (password.length < 6) {
    throw httpError(400, "Password must be at least 6 characters.");
  }
  if (role !== undefined && !allowedRoles.includes(role)) {
    throw httpError(400, "Role must be admin or librarian.");
  }
  if (role === "admin" && req.user.role !== "superAdmin") {
    throw httpError(403, "Only a superAdmin can create administrator accounts.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) throw httpError(409, "Email already exists.");

  let user;
  try {
    user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: role ?? "librarian",
    });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, "Email already exists.");
    throw error;
  }

  return res.status(201).json({ success: true, data: toUserResponse(user) });
});

export const updateUser = asyncHandler(async (req, res) => {
  const updates = req.body ?? {};
  const fields = Object.keys(updates);
  const allowedFields = ["name", "role", "isActive"];

  if (fields.length === 0) {
    throw httpError(400, "Provide at least one user field to update.");
  }
  if (fields.some((field) => !allowedFields.includes(field))) {
    throw httpError(400, "Only name, role, and isActive can be updated.");
  }
  if (updates.name !== undefined && (typeof updates.name !== "string" || !updates.name.trim())) {
    throw httpError(400, "Name must be a non-empty string.");
  }
  if (updates.role !== undefined && !allowedRoles.includes(updates.role)) {
    throw httpError(400, "Role must be admin or librarian.");
  }
  if (updates.role === "admin" && req.user.role !== "superAdmin") {
    throw httpError(403, "Only a superAdmin can assign the administrator role.");
  }
  if (updates.isActive !== undefined && typeof updates.isActive !== "boolean") {
    throw httpError(400, "isActive must be a boolean.");
  }

  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, "User not found.");

  requireSuperAdminForPrivilegedUser(user, req.user);

  const changingOwnRole =
    updates.role !== undefined && updates.role !== user.role;
  const deactivatingSelf = updates.isActive === false;
  if (
    user._id.toString() === req.user._id.toString() &&
    (changingOwnRole || deactivatingSelf)
  ) {
    preventSelfLockout(user, req.user._id);
  }

  if (
    user.role === "superAdmin" &&
    (updates.role !== undefined || updates.isActive === false)
  ) {
    throw httpError(400, "The superAdmin account cannot be demoted or deactivated.");
  }

  if (updates.name !== undefined) user.name = updates.name.trim();
  if (updates.role !== undefined) user.role = updates.role;
  if (updates.isActive !== undefined) user.isActive = updates.isActive;

  await user.save();
  return res.status(200).json({ success: true, data: toUserResponse(user) });
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, "User not found.");

  requireSuperAdminForPrivilegedUser(user, req.user);

  if (user.role === "superAdmin") {
    throw httpError(400, "The superAdmin account cannot be deactivated.");
  }

  preventSelfLockout(user, req.user._id);

  user.isActive = false;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "User deactivated successfully.",
    data: toUserResponse(user),
  });
});

export const activateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, "User not found.");

  requireSuperAdminForPrivilegedUser(user, req.user);

  user.isActive = true;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "User activated successfully.",
    data: toUserResponse(user),
  });
});