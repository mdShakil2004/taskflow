import { FastifyReply, FastifyRequest } from "fastify";
import { authService } from "./auth.service";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./auth.schema";

// Controllers stay thin: parse/validate input, call the service, map the response.
export const authController = {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input);
    reply.status(201).send(result);
  },

  async login(request: FastifyRequest, reply: FastifyReply) {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input);
    reply.status(200).send(result);
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const input = refreshSchema.parse(request.body);
    const result = await authService.refresh(input);
    reply.status(200).send(result);
  },

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const input = logoutSchema.parse(request.body);
    await authService.logout(input);
    reply.status(204).send();
  },

  async myOrganizations(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as FastifyRequest & { verifiedUserId?: string }).verifiedUserId!;
    const organizations = await authService.listMyOrganizations(userId);
    reply.status(200).send({ data: organizations });
  },
};
