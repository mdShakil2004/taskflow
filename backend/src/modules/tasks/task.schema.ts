import { z } from "zod";
import { TaskPriority, TaskStatus } from "@prisma/client";

const taskStatusEnum = z.nativeEnum(TaskStatus);
const taskPriorityEnum = z.nativeEnum(TaskPriority);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.coerce.date().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const taskFilterQuerySchema = z.object({
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().uuid().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  search: z.string().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const bulkStatusUpdateSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(200),
  status: taskStatusEnum,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskFilterQuery = z.infer<typeof taskFilterQuerySchema>;
export type BulkStatusUpdateInput = z.infer<typeof bulkStatusUpdateSchema>;
