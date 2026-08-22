import { AppError } from "../../shared/errors/app-error";
import { buildPaginatedResult, PaginationQuery } from "../../shared/pagination/pagination";
import { projectRepository } from "./project.repository";
import { CreateProjectInput, UpdateProjectInput } from "./project.schema";

export const projectService = {
  async list(organizationId: string, pagination: PaginationQuery) {
    const { data, total } = await projectRepository.list(organizationId, pagination);
    return buildPaginatedResult(data, total, pagination);
  },

  async getById(organizationId: string, id: string) {
    const project = await projectRepository.findByIdInOrg(organizationId, id);
    if (!project) {
      throw AppError.notFound("PROJECT_NOT_FOUND", "Project not found");
    }
    return project;
  },

  create(organizationId: string, input: CreateProjectInput) {
    return projectRepository.create(organizationId, input);
  },

  async update(organizationId: string, id: string, input: UpdateProjectInput) {
    const result = await projectRepository.update(organizationId, id, input);
    if (result.count === 0) {
      throw AppError.notFound("PROJECT_NOT_FOUND", "Project not found");
    }
    return projectRepository.findByIdInOrg(organizationId, id);
  },

  // RBAC: project deletion is admin-only, enforced at the route level via
  // requireRole("org_admin") — this service assumes that check already passed.
  async delete(organizationId: string, id: string) {
    const result = await projectRepository.softDelete(organizationId, id);
    if (result.count === 0) {
      throw AppError.notFound("PROJECT_NOT_FOUND", "Project not found");
    }
  },
};
