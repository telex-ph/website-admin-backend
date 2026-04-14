/**
 * Longest-prefix / exact match first (more specific routes before "/").
 */
const ENTRIES: Array<{ match: string; exact?: boolean; label: string; section: string }> = [
  // Marketing Pages
  { match: "/", exact: true, label: "Home", section: "Home" },
  { match: "/contact", label: "Contact Us", section: "Marketing" },
  { match: "/privacy-policy", label: "Privacy Policy", section: "Legal" },
  { match: "/terms-of-service", label: "Terms of Service", section: "Legal" },

  // About Section
  { match: "/about/company-overview", label: "Company Overview", section: "About" },
  { match: "/about/mission-vision-values", label: "Mission, Vision & Values", section: "About" },
  { match: "/about/why-choose-us", label: "Why Choose Us", section: "About" },
  { match: "/about/our-team", label: "Our Team", section: "About" },
  { match: "/about", label: "About Us", section: "About" },

  // Services Section
  { match: "/services/what-we-offer", label: "What We Offer", section: "Services" },
  { match: "/services/contact-us", label: "Contact Us (Services)", section: "Services" },
  { match: "/services/our-works", label: "Our Works", section: "Services" },
  { match: "/services/testimonials", label: "Testimonials", section: "Services" },
  { match: "/services", label: "Our Services", section: "Services" },

  // Why Us Section
  { match: "/why-us", label: "Why Choose Us", section: "Why Us" },

  // Resources Section
  { match: "/resources/industry-use-cases", label: "Industry Use Cases", section: "Resources" },
  { match: "/resources/blogs", label: "Blogs", section: "Resources" },
  { match: "/resources/case-studies", label: "Case Studies", section: "Resources" },
  { match: "/resources", label: "Resources Home", section: "Resources" },

  // Careers Section
  { match: "/careers/careers-home", label: "Careers Home", section: "Careers" },
  { match: "/careers/careers-details", label: "Careers Details", section: "Careers" },
  { match: "/careers/job-details", label: "Job Details", section: "Careers" },
  { match: "/careers", label: "Careers", section: "Careers" },

  // Dynamic Content (e.g., Blog Posts, Case Studies)
  { match: "/blog/", label: "Blog Post", section: "Blog" }, // Catch-all for blog posts
  { match: "/case-study/", label: "Case Study", section: "Case Studies" }, // Catch-all for case studies
];

export function resolvePageMeta(rawPath: string): {
  page: string;
  label: string;
  section: string;
} {
  const path = (rawPath.split("?")[0] || "/").trim() || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;

  for (const e of ENTRIES) {
    if (e.exact) {
      if (normalized === e.match) {
        return { page: normalized, label: e.label, section: e.section };
      }
    } else if (normalized === e.match || normalized.startsWith(e.match)) {
      // For dynamic content, try to extract a more specific label
      if (e.match === "/blog/" && normalized.length > e.match.length) {
        const slug = normalized.substring(e.match.length).replace(/-/g, ' ');
        return { page: normalized, label: `Blog: ${capitalizeWords(slug)}`, section: e.section };
      }
      if (e.match === "/case-study/" && normalized.length > e.match.length) {
        const slug = normalized.substring(e.match.length).replace(/-/g, ' ');
        return { page: normalized, label: `Case Study: ${capitalizeWords(slug)}`, section: e.section };
      }
      return { page: normalized, label: e.label, section: e.section };
    }
  }

  // Fallback for unmatched paths
  const parts = normalized.split("/").filter(Boolean);
  const section = parts[0] ? capitalizeWords(parts[0]) : "Other";
  const label = parts.length > 0 ? capitalizeWords(parts.join(' ').replace(/-/g, ' ')) : "Unknown Page";

  return {
    page: normalized,
    label: label,
    section: section,
  };
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}
