import mongoose from "mongoose";
const { Schema, model } = mongoose;

export interface IService {
  _id: mongoose.Types.ObjectId;
  serviceId: string; // 'ai-builder', 'automation', etc.
  name: string;
  description: string;
  badge: string;
  isActive: boolean;
  coverPhoto?: string; // base64 string or URL
  inactivePhoto?: string; // base64 string or URL shown when service is inactive
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    serviceId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    badge: { type: String, required: true },
    isActive: { type: Boolean, default: false },
    coverPhoto: { type: String, default: null },
    inactivePhoto: { type: String, default: null },
  },
  { timestamps: true }
);

// ============================================
// 📊 INDEXES
// ============================================
// FIX: MongoDB Atlas free tier has a 32MB in-memory sort limit. Without indexes
// on the fields we sort by, Mongo loads the entire collection into memory to sort
// it — and if the documents are large (e.g. base64 coverPhoto strings), it blows
// past the 32MB cap and throws:
//   "Sort exceeded memory limit of 33554432 bytes, but did not opt in to external sorting."
// Adding indexes on createdAt and name lets MongoDB use the index to satisfy the
// sort order without loading everything into memory first.
serviceSchema.index({ createdAt: -1 }); // default sort: newest first
serviceSchema.index({ name: 1 });        // alpha sort support

export default model<IService>("Service", serviceSchema);