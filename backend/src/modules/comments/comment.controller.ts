import { FastifyReply, FastifyRequest } from "fastify";
import { commentService } from "./comment.service";
import { commentParamsSchema, createCommentSchema } from "./comment.schema";

export const commentController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { taskId } = commentParamsSchema.parse(request.params);
    const comments = await commentService.list(request.auth!.organizationId, taskId);
    reply.status(200).send({ data: comments });
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { taskId } = commentParamsSchema.parse(request.params);
    const { body } = createCommentSchema.parse(request.body);
    const comment = await commentService.create(request.auth!.organizationId, taskId, request.auth!.userId, body);
    reply.status(201).send(comment);
  },
};
