import mongoose from "mongoose";
const { Schema, model } = mongoose;

export interface IApplicant {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  dob: string;
  gender: string;
  services: string[];
  experienceLevel: string;
  availability: string;
  timezone: string;
  rate: string;
  startDate: string;
  coverLetter: string;
  resumeUrl: string;
  resumeOriginalName: string;
  status: 'pending' | 'approved' | 'rejected';
  confirmCode: string;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const applicantSchema = new Schema<IApplicant>(
  {
    firstName:          { type: String, required: true, trim: true },
    lastName:           { type: String, required: true, trim: true },
    middleName:         { type: String, trim: true, default: '' },
    email:              { type: String, required: true, trim: true, lowercase: true },
    phone:              { type: String, required: true, trim: true },
    address:            { type: String, required: true, trim: true },
    city:               { type: String, required: true, trim: true },
    state:              { type: String, trim: true, default: '' },
    zip:                { type: String, required: true, trim: true },
    country:            { type: String, required: true, trim: true },
    dob:                { type: String, required: true },
    gender:             { type: String, trim: true, default: '' },
    services:           { type: [String], required: true },
    experienceLevel:    { type: String, required: true },
    availability:       { type: String, required: true },
    timezone:           { type: String, required: true },
    rate:               { type: String, required: true, trim: true },
    startDate:          { type: String, default: '' },
    coverLetter:        { type: String, default: '' },
    resumeUrl:          { type: String, default: '' },
    resumeOriginalName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    confirmCode: { type: String, required: true },
    appliedAt:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

applicantSchema.index({ appliedAt: -1 });
applicantSchema.index({ status: 1 });

export default model<IApplicant>('Applicant', applicantSchema);
