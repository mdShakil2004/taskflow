import { FastifyReply, FastifyRequest } from "fastify";
import { assignmentService } from "./assignment.service";
import { assignmentParamsSchema, createAssignmentSchema, unassignParamsSchema } from "./assignment.schema";

export const assignmentController = {
  async assign(request: FastifyRequest, reply: FastifyReply) {
    const { taskId } = assignmentParamsSchema.parse(request.params);
    const { userId } = createAssignmentSchema.parse(request.body);
    const result = await assignmentService.assign(request.auth!.organizationId, taskId, userId);
    reply.status(201).send({
      assignment: result.assignment,
      jobId: result.jobId ?? null,
    });
  },

  async unassign(request: FastifyRequest, reply: FastifyReply) {
    const { taskId, userId } = unassignParamsSchema.parse(request.params);
    await assignmentService.unassign(request.auth!.organizationId, taskId, userId);
    reply.status(204).send();
  },
};
