export type AuthPayload = {
  id: string;
  email: string;
  role: number; // Changed from string to number (1: Main Admin, 2: Admin)
};
