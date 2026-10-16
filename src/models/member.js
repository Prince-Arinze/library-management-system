import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: "Email must be valid.",
      },
    },
    phone: {
      type: String,
      trim: true,
    },
    membershipNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

memberSchema.pre("validate", async function () {
  if (!this.isNew || this.membershipNumber) return;

  const year = new Date().getFullYear();

  const lastMember = await this.constructor
    .findOne({
      membershipNumber: new RegExp(`^LIB-${year}-`),
    })
    .sort({ membershipNumber: -1 })
    .select("membershipNumber");

  let nextNumber = 1;

  if (lastMember) {
    const lastNumber = Number(lastMember.membershipNumber.split("-")[2]);

    nextNumber = lastNumber + 1;
  }

  this.membershipNumber = `LIB-${year}-${String(nextNumber).padStart(4, "0")}`;
});

memberSchema.index(
  { lastName: 1, firstName: 1 },
  { name: "lastName_firstName" },
);
memberSchema.index({ status: 1 }, { name: "status" });

const Member = mongoose.model("Member", memberSchema);

export default Member;
