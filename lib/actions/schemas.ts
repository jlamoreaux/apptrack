import { z } from "zod";

// Password validation regex patterns
export const passwordRequirements = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/,
};

// Validation schemas
export const signUpSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(passwordRequirements.minLength, `Password must be at least ${passwordRequirements.minLength} characters`)
      .refine((password) => passwordRequirements.hasUppercase.test(password), {
        message: "Password must contain at least one uppercase letter",
      })
      .refine((password) => passwordRequirements.hasLowercase.test(password), {
        message: "Password must contain at least one lowercase letter",
      })
      .refine((password) => passwordRequirements.hasNumber.test(password), {
        message: "Password must contain at least one number",
      })
      .refine((password) => passwordRequirements.hasSpecialChar.test(password), {
        message: "Password must contain at least one special character",
      }),
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
  job_description: z.string().optional(),
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
