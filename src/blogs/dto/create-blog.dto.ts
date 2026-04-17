import z from "zod";

// Main Category values
const mainCategoryValues = [
  "Main Service Categories",
  "Industry-Specific Insights",
  "Business Growth & Strategy",
  "Company Culture & Updates",
] as const;

// Subcategory values
const mainServiceSubcategoryValues = [
  "Customer Experience (CX)",
  "Back Office Solutions",
  "Virtual Assistance",
  "Sales & Lead Generation",
] as const;

const industrySpecificSubcategoryValues = [
  "E-commerce Support",
  "Real Estate Outsourcing",
  "Healthcare BPO",
  "Tech & SaaS Scaling",
] as const;

const businessGrowthSubcategoryValues = [
  "Scale Smarter",
  "Outsourcing 101",
  "Cost Optimization",
] as const;

const companyCultureSubcategoryValues = [
  "TelexPH Life",
  "News & Press Releases",
] as const;

// Zod schemas
export const MainCategoryEnum = z.enum(mainCategoryValues);

export const MainServiceSubcategoryEnum = z.enum(mainServiceSubcategoryValues);

export const IndustrySpecificSubcategoryEnum = z.enum(industrySpecificSubcategoryValues);

export const BusinessGrowthSubcategoryEnum = z.enum(businessGrowthSubcategoryValues);

export const CompanyCultureSubcategoryEnum = z.enum(companyCultureSubcategoryValues);

// Content section schema
const contentSectionSchema = z.object({
  title: z.string().min(1, "Content section title is required"),
  content: z.string().min(1, "Content section content is required"),
});

// Combined subcategory schema
const subcategorySchema = z.union([
  MainServiceSubcategoryEnum,
  IndustrySpecificSubcategoryEnum,
  BusinessGrowthSubcategoryEnum,
  CompanyCultureSubcategoryEnum,
]);

export const createBlogSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    // BAGUHIN ITO: Alisin ang regex para sa ObjectId
    author: z.string().min(1, "Author name is required"), 
    mainCategory: MainCategoryEnum,
    subcategory: subcategorySchema,
    shortDescription: z.string().min(10, "Short description must be at least 10 characters"),
    mainContent: z
      .array(contentSectionSchema)
      .min(1, "At least one content section is required"),
    status: z.enum(["published", "draft", "scheduled"]),
    scheduledDate: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      // Validate subcategory matches main category
      const subcategoryMap: { [key: string]: readonly string[] } = {
        "Main Service Categories": mainServiceSubcategoryValues,
        "Industry-Specific Insights": industrySpecificSubcategoryValues,
        "Business Growth & Strategy": businessGrowthSubcategoryValues,
        "Company Culture & Updates": companyCultureSubcategoryValues,
      };

      const validSubcategories = subcategoryMap[data.mainCategory];
      if (!validSubcategories) return false;

      return validSubcategories.includes(data.subcategory as any);
    },
    {
      message: "Subcategory does not match the selected main category",
      path: ["subcategory"],
    }
  )
  .refine(
    (data) => {
      // Scheduled date is required if status is scheduled
      if (data.status === "scheduled") {
        return !!data.scheduledDate;
      }
      return true;
    },
    {
      message: "Scheduled date is required when status is 'scheduled'",
      path: ["scheduledDate"],
    }
  );

export type CreateBlogDto = z.infer<typeof createBlogSchema>;
