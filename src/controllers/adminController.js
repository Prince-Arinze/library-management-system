import User from "../models/userModel.js";

// GET /api/users - List staff accounts; admin only (PDF 6.1)
export const getUsers = async (req, res) => {
  try {
    // Don't return password, already excluded by schema select:false
    const users = await User.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/users/:id - Get single staff
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ message: "Invalid user ID" });
  }
};

// POST /api/users - Create a staff account; admin only (PDF 6.1)
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation - PDF: Validate request bodies
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check duplicate - PDF: Handle duplicate-key errors
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Password hashing happens in User.js pre-save hook - PDF Rule
    const user = await User.create({
      name,
      email,
      password,
      role: role || "librarian" // default librarian - per schema
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists (duplicate key)" });
    }
    res.status(400).json({ message: error.message });
  }
};

// PATCH /api/users/:id - Update staff role / status - Admin only
export const updateUser = async (req, res) => {
  try {
    const { name, role, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent admin deactivating themselves
    if (req.user._id.toString() === user._id.toString() && isActive === false) {
      return res.status(400).json({ message: "You cannot deactivate your own account" });
    }

    if (name) user.name = name;
    if (role && ["admin", "librarian"].includes(role)) user.role = role;
    if (typeof isActive === "boolean") user.isActive = isActive;

    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PATCH /api/users/:id/deactivate - Prefer deactivation over deletion (PDF Rule)
export const deactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({ message: "Cannot deactivate yourself" });
    }

    user.isActive = false;
    await user.save();

    res.json({ success: true, message: "User deactivated", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/users/:id/activate - Reactivate
export const activateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, message: "User activated", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};