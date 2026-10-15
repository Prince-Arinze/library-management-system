import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  membershipNumber: { type: String, required: true, unique: true, trim: true },
  address: { type: String, trim: true },
  status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
  registeredAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("Member", memberSchema);