import { AppError } from "../../shared/errors/app-error";
import { organizationRepository } from "./organization.repository";

export const organizationService = {
  // Organization is always resolved from request.auth.organizationId (never
  // from a client-supplied id in the path/body) — see tenant.middleware.ts.
  async getCurrent(organizationId: string) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) {
      throw AppError.notFound("ORGANIZATION_NOT_FOUND", "Organization not found");
    }
    return org;
  },
};
