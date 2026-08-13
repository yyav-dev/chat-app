import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Name must contain at least 3 characters")
    .max(100, "Name cannot exceed 100 characters"),

  email: z
    .email("Invalid email address")
    .trim()
    .toLowerCase(),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(50, "Password cannot exceed 50 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      "Password must contain uppercase, lowercase and a number"
    ),
});
export const loginSchema = z.object({
  email: z
    .email("Invalid email address")
    .trim()
    .toLowerCase(),

  password: z
    .string()
    .min(1, "Password is required"),
});