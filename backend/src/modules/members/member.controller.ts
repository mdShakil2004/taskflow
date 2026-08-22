import { FastifyReply, FastifyRequest } from "fastify";
import { memberService } from "./member.service";
import { addMemberSchema, updateMemberRoleSchema } from "./member.schema";

export const memberController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const members = await memberService.list(request.auth!.organizationId);
    reply.status(200).send({ data: members });
  },

  async add(request: FastifyRequest, reply: FastifyReply) {
    const input = addMemberSchema.parse(request.body);
    const member = await memberService.add(request.auth!.organizationId, input);
    reply.status(201).send(member);
  },

  async updateRole(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string };
    const input = updateMemberRoleSchema.parse(request.body);
    const member = await memberService.updateRole(request.auth!.organizationId, userId, input);
    reply.status(200).send(member);
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string };
    await memberService.remove(request.auth!.organizationId, userId);
    reply.status(204).send();
  },
};
