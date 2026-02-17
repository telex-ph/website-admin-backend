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
  },
  { timestamps: true }
);
 
export default model<IService>("Service", serviceSchema);