import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const createTicketSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
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
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  status: z
    .enum(["OPEN", "IN_PROGRESS", "AWAITING_LOGS", "RESOLVED", "CLOSED"])
    .optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
