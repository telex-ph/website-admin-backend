// src/services/blogService.ts

// Palitan ito kung iba ang port ng backend mo
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export const fetchBlogs = async () => {
  // Ito yung public route na pinalaya natin sa index.ts
  const res = await fetch(`${API_URL}/blogs`, { 
    cache: 'no-store' // Para laging fresh ang data
  });
  
  if (!res.ok) {
    throw new Error("Failed to fetch blogs");
  }
  
  return res.json();
};

export const fetchBlogBySlug = async (slug: string) => {
  const res = await fetch(`${API_URL}/blogs/fetch/${slug}`, {
    cache: 'no-store'
  });
  
  if (!res.ok) return null;
  return res.json();
};