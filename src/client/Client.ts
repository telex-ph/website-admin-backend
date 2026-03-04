import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface IClient {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  profilePicture?: string | null;
  password: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClient>(
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
    password: {
      type: String,
      required: true,
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

// ✅ NO pre-save hook for password hashing.
// Hashing is done explicitly in each controller before calling Client.create()
// or Client.findByIdAndUpdate(), so there is zero ambiguity about when/if hashing runs.

const Client =
  (models.Client as mongoose.Model<IClient>) ||
  model<IClient>("Client", clientSchema);

export default Client;