import { AppError } from "../../shared/errors/app-error";
import { buildPaginatedResult } from "../../shared/pagination/pagination";
import { projectRepository } from "../projects/project.repository";
import { taskRepository } from "./task.repository";
import { BulkStatusUpdateInput, CreateTaskInput, TaskFilterQuery, UpdateTaskInput } from "./task.schema";

async function assertProjectInOrg(organizationId: string, projectId: string) {
  const project = await projectRepository.findByIdInOrg(organizationId, projectId);
  if (!project) {
    throw AppError.notFound("PROJECT_NOT_FOUND", "Project not found");
  }
  return project;
}

export const taskService = {
  async list(organizationId: string, projectId: string, filters: TaskFilterQuery) {
    await assertProjectInOrg(organizationId, projectId);
    const { data, total } = await taskRepository.list(organizationId, projectId, filters);
    return buildPaginatedResult(data, total, filters);
  },

  async getById(organizationId: string, taskId: string) {
    const task = await taskRepository.findByIdInOrg(organizationId, taskId);
    if (!task) {
      throw AppError.notFound("TASK_NOT_FOUND", "Task not found");
    }
    return task;
  },

  async create(organizationId: string, projectId: string, input: CreateTaskInput) {
    await assertProjectInOrg(organizationId, projectId);
    return taskRepository.create(projectId, input);
  },

  async update(organizationId: string, taskId: string, input: UpdateTaskInput) {
    const count = await taskRepository.update(organizationId, taskId, input);
    if (count === 0) {
      throw AppError.notFound("TASK_NOT_FOUND", "Task not found");
    }
    return taskRepository.findByIdInOrg(organizationId, taskId);
  },

  async delete(organizationId: string, taskId: string) {
    const count = await taskRepository.softDelete(organizationId, taskId);
    if (count === 0) {
      throw AppError.notFound("TASK_NOT_FOUND", "Task not found");
    }
  },

  async bulkUpdateStatus(organizationId: string, input: BulkStatusUpdateInput) {
    const count = await taskRepository.bulkUpdateStatus(organizationId, input.taskIds, input.status);
    return { updated: count };
  },

  async dashboard(organizationId: string, projectId: string) {
    await assertProjectInOrg(organizationId, projectId);
    return taskRepository.dashboardCounts(organizationId, projectId);
  },
};
