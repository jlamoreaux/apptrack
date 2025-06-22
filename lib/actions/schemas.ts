import { z } from "zod";

// Validation schemas
export const signUpSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const applicationSchema = z.object({
  company: z.string().min(1, "Company name is required"),
  role: z.string().min(1, "Role title is required"),
  role_link: z.string().url().optional().or(z.literal("")),
  date_applied: z.string().min(1, "Date applied is required"),
  status: z.enum([
    "Applied",
    "Interview Scheduled",
    "Interviewed",
    "Offer",
    "Rejected",
  ]),
});

export const linkedinProfileSchema = z.object({
  profile_url: z.string().url("Invalid LinkedIn URL"),
  name: z.string().optional(),
  title: z.string().optional(),
});

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
});
