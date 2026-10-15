import User from "../models/userModel.js";
import { generateToken } from "../utils/generateToken.js";

// POST /api/auth/login - Sign in (PDF Route)
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email ||!password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    // select +password because schema has select:false
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account deactivated" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/auth/me - Get the authenticated user (PDF Route)
export const getMe = async (req, res) => {
  try {
    // req.user is set by protect middleware
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};