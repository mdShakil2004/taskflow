import { AppError } from "../../shared/errors/app-error";
import { commentRepository } from "./comment.repository";

export const commentService = {
  async list(organizationId: string, taskId: string) {
    const task = await commentRepository.findTaskInOrg(organizationId, taskId);
    if (!task) {
      throw AppError.notFound("TASK_NOT_FOUND", "Task not found");
    }
    return commentRepository.list(taskId);
  },

  async create(organizationId: string, taskId: string, authorId: string, body: string) {
    const task = await commentRepository.findTaskInOrg(organizationId, taskId);
    if (!task) {
      throw AppError.notFound("TASK_NOT_FOUND", "Task not found");
    }
    return commentRepository.create(taskId, authorId, body);
  },
};
