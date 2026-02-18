import mongoose from "mongoose";
const { Schema, model } = mongoose;

// Main Category constants
export const MainCategory = {
  MAIN_SERVICE_CATEGORIES: "Main Service Categories",
  INDUSTRY_SPECIFIC_INSIGHTS: "Industry-Specific Insights",
  BUSINESS_GROWTH_STRATEGY: "Business Growth & Strategy",
  COMPANY_CULTURE_UPDATES: "Company Culture & Updates",
} as const;

// Subcategory constants by main category
export const MainServiceSubcategory = {
  CUSTOMER_EXPERIENCE: "Customer Experience (CX)",
  BACK_OFFICE_SOLUTIONS: "Back Office Solutions",
  VIRTUAL_ASSISTANCE: "Virtual Assistance",
  SALES_LEAD_GENERATION: "Sales & Lead Generation",
} as const;

export const IndustrySpecificSubcategory = {
  ECOMMERCE_SUPPORT: "E-commerce Support",
  REAL_ESTATE_OUTSOURCING: "Real Estate Outsourcing",
  HEALTHCARE_BPO: "Healthcare BPO",
  TECH_SAAS_SCALING: "Tech & SaaS Scaling",
} as const;

export const BusinessGrowthSubcategory = {
  SCALE_SMARTER: "Scale Smarter",
  OUTSOURCING_101: "Outsourcing 101",
  COST_OPTIMIZATION: "Cost Optimization",
} as const;

export const CompanyCultureSubcategory = {
  TELEXPH_LIFE: "TelexPH Life",
  NEWS_PRESS_RELEASES: "News & Press Releases",
} as const;

// TypeScript interfaces
export interface IContentSection {
  title: string;
  content: string;
}

export interface IBlog {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  author: string;
  mainCategory: string;
  subcategory: string;
  shortDescription: string;
  mainContent: IContentSection[];
  picture: string;
  status: "published" | "draft" | "scheduled";
  scheduledDate?: Date;
  likeCount: number;
  likedBy: string[];
  isArchive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to get all values
const getAllValues = (obj: Record<string, string>) => Object.values(obj);

// Content section schema
const contentSectionSchema = new Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const blogSchema = new Schema<IBlog>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    author: {
      type: String,
      required: true,
    },
    mainCategory: {
      type: String,
      enum: getAllValues(MainCategory),
      required: true,
    },
    subcategory: {
      type: String,
      required: true,
      validate: {
        validator: function (this: any, value: string) {
          // 1. Kunin ang mainCategory depende sa context (Create vs Update)
          let mainCat = this.mainCategory;

          // Check kung ito ay isang Update operation (findByIdAndUpdate / patch)
          if (!mainCat && this.getUpdate) {
            const update = this.getUpdate();
            // Tinitingnan kung nasa direct body o nasa loob ng $set ang mainCategory
            mainCat = update.mainCategory || (update.$set && update.$set.mainCategory);
          }

          // 2. Validate subcategory based on main category
          const validSubcategories: { [key: string]: string[] } = {
            [MainCategory.MAIN_SERVICE_CATEGORIES]: getAllValues(MainServiceSubcategory),
            [MainCategory.INDUSTRY_SPECIFIC_INSIGHTS]: getAllValues(IndustrySpecificSubcategory),
            [MainCategory.BUSINESS_GROWTH_STRATEGY]: getAllValues(BusinessGrowthSubcategory),
            [MainCategory.COMPANY_CULTURE_UPDATES]: getAllValues(CompanyCultureSubcategory),
          };

          // 3. Kung nag-uupdate tayo ng subcategory lang at hindi kasama ang mainCategory sa payload,
          // kailangan nating payagan ito o i-skip ang validation kung walang mainCat na mahanap
          // para hindi mag-error. Pero mas safe kung laging sine-send ng frontend ang dalawa.
          if (!mainCat) return true;

          const allowedSubcategories = validSubcategories[mainCat] || [];
          return allowedSubcategories.includes(value);
        },
        message: "Subcategory does not match the selected main category",
      },
    },
    shortDescription: { type: String, required: true },
    mainContent: { type: [contentSectionSchema], required: true },
    picture: { type: String, required: true },
    status: {
      type: String,
      enum: ["published", "draft", "scheduled"],
      required: true,
    },
    scheduledDate: { type: Date, required: false },
    likeCount: { type: Number, default: 0 },
    likedBy: { type: [String], default: [] },
    isArchive: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
blogSchema.index({ slug: 1 });
blogSchema.index({ mainCategory: 1, subcategory: 1 });
blogSchema.index({ status: 1 });
blogSchema.index({ createdAt: -1 });
blogSchema.index({ likeCount: -1 });
blogSchema.index({ isArchive: 1 });

const Blog = model<IBlog>("Blog", blogSchema);
export default Blog;