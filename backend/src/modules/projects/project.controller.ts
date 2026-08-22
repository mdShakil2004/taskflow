import { FastifyReply, FastifyRequest } from "fastify";
import { projectService } from "./project.service";
import { createProjectSchema, projectIdParamSchema, updateProjectSchema } from "./project.schema";
import { paginationQuerySchema } from "../../shared/pagination/pagination";

export const projectController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const pagination = paginationQuerySchema.parse(request.query);
    const result = await projectService.list(request.auth!.organizationId, pagination);
    reply.status(200).send(result);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = projectIdParamSchema.parse(request.params);
    const project = await projectService.getById(request.auth!.organizationId, id);
    reply.status(200).send(project);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createProjectSchema.parse(request.body);
    const project = await projectService.create(request.auth!.organizationId, input);
    reply.status(201).send(project);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = projectIdParamSchema.parse(request.params);
    const input = updateProjectSchema.parse(request.body);
    const project = await projectService.update(request.auth!.organizationId, id, input);
    reply.status(200).send(project);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = projectIdParamSchema.parse(request.params);
    await projectService.delete(request.auth!.organizationId, id);
    reply.status(204).send();
  },
};
