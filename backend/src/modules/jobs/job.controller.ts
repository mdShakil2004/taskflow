import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { jobService } from "./job.service";

const jobParamsSchema = z.object({ id: z.string().min(1) });

export const jobController = {
  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = jobParamsSchema.parse(request.params);
    const status = await jobService.getStatus(id);
    reply.status(200).send(status);
  },
};
