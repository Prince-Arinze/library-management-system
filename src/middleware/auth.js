import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

export const protect = asyncHandler(async (req, _res, next) => {
  const authorization = req.get("authorization") || "";
  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra) {
    throw httpError(401, "Authentication required.");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, "Invalid or expired token.");
  }

  if (
    !decoded ||
    typeof decoded !== "object" ||
    typeof decoded.sub !== "string" ||
    !mongoose.isValidObjectId(decoded.sub)
  ) {
    throw httpError(401, "Invalid or expired token.");
  }

  req.user = await User.findById(decoded.sub).select("-password");

  if (!req.user) {
    throw httpError(401, "Invalid or expired token.");
  }
  if (!req.user.isActive) {
    throw httpError(401, "Account is inactive.");
  }
  return next();
});

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: "Authentication required." },
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: "You are not authorized to access this resource." },
      });
    }
    next();
  };
};