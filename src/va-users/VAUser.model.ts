// src/va-users/VAUser.model.ts
import mongoose from "mongoose";
const { Schema, model } = mongoose;

export interface IVAUser {
  _id: mongoose.Types.ObjectId;
  applicantId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;           // bcrypt hashed
  services: string[];
  isActive: boolean;
  activationToken: string;    // one-time token sent in email
  activationExpiry: Date;     // token expires after 48 hours
  isActivated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VAUserSchema = new Schema<IVAUser>(
  {
    applicantId:      { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
    firstName:        { type: String, required: true, trim: true },
    lastName:         { type: String, required: true, trim: true },
    email:            { type: String, required: true, unique: true, trim: true, lowercase: true },
    password:         { type: String, default: '' },
    services:         { type: [String], default: [] },
    isActive:         { type: Boolean, default: false },
    activationToken:  { type: String, default: '' },
    activationExpiry: { type: Date,   required: true },
    isActivated:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

VAUserSchema.index({ email: 1 });
VAUserSchema.index({ activationToken: 1 });

export default model<IVAUser>('VAUser', VAUserSchema);