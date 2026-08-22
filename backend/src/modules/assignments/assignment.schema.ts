import { z } from "zod";

export const createAssignmentSchema = z.object({
  userId: z.string().uuid(),
});

export const assignmentParamsSchema = z.object({
  taskId: z.string().uuid(),
});

export const unassignParamsSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
