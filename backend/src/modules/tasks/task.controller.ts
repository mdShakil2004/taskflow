import { FastifyReply, FastifyRequest } from "fastify";
import { taskService } from "./task.service";
import {
  bulkStatusUpdateSchema,
  createTaskSchema,
  taskFilterQuerySchema,
  updateTaskSchema,
} from "./task.schema";
import { z } from "zod";

const taskIdParamSchema = z.object({ taskId: z.string().uuid() });
const projectIdParamSchema = z.object({ projectId: z.string().uuid() });

export const taskController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { projectId } = projectIdParamSchema.parse(request.params);
    const filters = taskFilterQuerySchema.parse(request.query);
    const result = await taskService.list(request.auth!.organizationId, projectId, filters);
    reply.status(200).send(result);
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { taskId } = taskIdParamSchema.parse(request.params);
    const task = await taskService.getById(request.auth!.organizationId, taskId);
    reply.status(200).send(task);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { projectId } = projectIdParamSchema.parse(request.params);
    const input = createTaskSchema.parse(request.body);
    const task = await taskService.create(request.auth!.organizationId, projectId, input);
    reply.status(201).send(task);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { taskId } = taskIdParamSchema.parse(request.params);
    const input = updateTaskSchema.parse(request.body);
    const task = await taskService.update(request.auth!.organizationId, taskId, input);
    reply.status(200).send(task);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { taskId } = taskIdParamSchema.parse(request.params);
    await taskService.delete(request.auth!.organizationId, taskId);
    reply.status(204).send();
  },

  async bulkUpdateStatus(request: FastifyRequest, reply: FastifyReply) {
    const input = bulkStatusUpdateSchema.parse(request.body);
    const result = await taskService.bulkUpdateStatus(request.auth!.organizationId, input);
    reply.status(200).send(result);
  },

  async dashboard(request: FastifyRequest, reply: FastifyReply) {
    const { projectId } = projectIdParamSchema.parse(request.params);
    const counts = await taskService.dashboard(request.auth!.organizationId, projectId);
    reply.status(200).send(counts);
  },
};
