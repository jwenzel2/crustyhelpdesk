import { z } from "zod";
import { ROLES } from "./roles";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const createTicketSchema = z.object({
  title: z.string().min(1, "Subject is required").max(200),
  description: z.string().min(1, "Description is required"),
  clientMachine: z
    .string()
    .min(1, "Client machine hostname is required")
    .max(255)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Hostname must contain only alphanumeric characters, dots, hyphens, and underscores"
    ),
  issueTimeStart: z.string().datetime({ message: "Valid start time required" }),
  issueTimeEnd: z.string().datetime({ message: "Valid end time required" }),
  categoryId: z.string().min(1, "Category is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  status: z
    .enum(["OPEN", "IN_PROGRESS", "AWAITING_LOGS", "ESCALATED", "RESOLVED", "CLOSED"])
    .optional(),
  escalationLevel: z.number().int().min(1).max(3).optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  categoryId: z.string().min(1).optional(),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username must contain only alphanumeric characters, dots, hyphens, and underscores"),
  displayName: z.string().min(1, "Display name is required").max(100),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(ROLES),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(ROLES).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().max(20).optional().or(z.literal("")),
  jobRole: z.string().max(100).optional().or(z.literal("")),
});

export const createCommentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(5000),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
