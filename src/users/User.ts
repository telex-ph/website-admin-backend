import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
      required: false,
    },
    department: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4, 5], // 1: Compliance, 2: Innovation, 3: Marketing, 4: Recruitment, 5: Human Resources
    },
    role: {
      type: Number,
      required: true,
      enum: [1, 2], // 1: Main Admin, 2: Admin
    },
    password: {
      type: String,
      required: true,
    },
    darkMode: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Check if model already exists before compiling
const User = models.User || model("User", userSchema);
export default User;