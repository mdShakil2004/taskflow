import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1).max(200),
  // Registration creates the user's first organization membership.
  // Either join an existing org by id, or create a new one by name.
  organizationName: z.string().min(1).max(200).optional(),
  organizationId: z.string().uuid().optional(),
}).refine((data) => data.organizationName || data.organizationId, {
  message: "Either organizationName (to create a new org) or organizationId (to join one) is required",
  path: ["organizationName"],
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
  allDevices: z.boolean().optional().default(false),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
