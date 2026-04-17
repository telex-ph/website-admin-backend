import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface IUser {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  profilePicture?: string | null;
  department: number;
  role: number;
  password: string;
  darkMode: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
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
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Check if model already exists before compiling
const User = (models.User as mongoose.Model<IUser>) || model<IUser>("User", userSchema);
export default User;
