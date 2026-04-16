import mongoose, { Schema, Document } from 'mongoose';

export interface IPageView extends Document {
  url: string;
  timestamp: Date;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  referrer?: string;
  isUnique: boolean;
  isConversion?: boolean;
  funnelName?: string;
}

const PageViewSchema = new Schema<IPageView>({
  url: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  userAgent: String,
  ip: String,
  referrer: String,
  isUnique: {
    type: Boolean,
    default: false
  },
  isConversion: {
    type: Boolean,
    default: false
  },
  funnelName: {
    type: String,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
PageViewSchema.index({ url: 1, timestamp: -1 });
PageViewSchema.index({ funnelName: 1, timestamp: -1 });
PageViewSchema.index({ timestamp: -1 });

export const PageView = mongoose.model<IPageView>('PageView', PageViewSchema);
