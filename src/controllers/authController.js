import jwt from "jsonwebtoken";
import User from "../models/user.js";
import catchAsync from "../utils/asyncHandler.js";

// Helper function to sign JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

// Send standard auth response containing token
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Remove password from output response
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    message: res.message, // Optional message passed from controller
    token,
    data: {
      user,
    },
  });
};

// Register User
export const register = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, role } = req.body;

  // Prevent direct registration as admin (per flow specifications)
  if (role === "admin") {
    return next(new AppError("Admin accounts cannot be created via public registration.", 400));
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError("An account with this email already exists.", 400));
  }

  const newUser = await User.create({
    name,
    email,
    phone,
    password,
    role: role || "customer",
  });

  createSendToken(newUser, 201, res);
});

// Login User
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password inputs
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }

  // Find user and explicitly select password field
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  createSendToken(user, 200, res);
});

// Get Current Profile
export const getMe = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: "success",
    message: "User profile retrieved successfully.",
    data: {
      user: req.user,
    },
  });
});


// Forgot Password Handler
export const forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with that email address.", 404));
  }

  // Generate random reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  const resetURL = `${req.protocol}://${req.get("host")}/api/v1/auth/reset-password/${resetToken}`;
  const message = `Forgot your password? Reset it using this link: ${resetURL}\nIf you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your MealMate Password Reset Token (valid for 10 min)",
      message,
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("There was an error sending the email. Try again later!", 500));
  }
});