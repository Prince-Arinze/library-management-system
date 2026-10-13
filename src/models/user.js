import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "librarian"],
      default: "librarian",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
userSchema.pre("save", async function (next) {
  if (!this.isModified("password"))return next();
  this.password = await bcrypt.hash(this.password, 10);
  next()
})

userSchema.methods.correctPassword = async function (CandidatePassword, userPassword){
  return await bcrypt.compare(CandidatePassword, userPassword)
};

const User = mongoose.model("User", userSchema);

export default User;
