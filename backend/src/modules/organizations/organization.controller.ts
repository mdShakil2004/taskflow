import { FastifyReply, FastifyRequest } from "fastify";
import { organizationService } from "./organization.service";

export const organizationController = {
  async getCurrent(request: FastifyRequest, reply: FastifyReply) {
    const org = await organizationService.getCurrent(request.auth!.organizationId);
    reply.status(200).send({ ...org, role: request.auth!.role });
  },
};
