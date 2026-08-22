import { AppError } from "../../shared/errors/app-error";
import { memberRepository } from "./member.repository";
import { AddMemberInput, UpdateMemberRoleInput } from "./member.schema";

export const memberService = {
  list(organizationId: string) {
    return memberRepository.listByOrganization(organizationId);
  },

  async add(organizationId: string, input: AddMemberInput) {
    const user = await memberRepository.findUserByEmail(input.email);
    if (!user) {
      throw AppError.notFound("USER_NOT_FOUND", "No user with that email exists yet — they must register first");
    }

    const existing = await memberRepository.findByOrgAndUser(organizationId, user.id);
    if (existing) {
      throw AppError.conflict("DUPLICATE_ASSIGNMENT", "User is already a member of this organization");
    }

    return memberRepository.addMember(organizationId, user.id, input.role);
  },

  async updateRole(organizationId: string, targetUserId: string, input: UpdateMemberRoleInput) {
    const member = await memberRepository.findByOrgAndUser(organizationId, targetUserId);
    if (!member) {
      throw AppError.notFound("MEMBER_NOT_FOUND", "Member not found in this organization");
    }

    // Prevent an org from being left without any admin.
    if (member.role === "org_admin" && input.role === "member") {
      const adminCount = await memberRepository.countAdmins(organizationId);
      if (adminCount <= 1) {
        throw AppError.validation("Cannot demote the last remaining admin of an organization");
      }
    }

    return memberRepository.updateRole(organizationId, targetUserId, input.role);
  },

  async remove(organizationId: string, targetUserId: string) {
    const member = await memberRepository.findByOrgAndUser(organizationId, targetUserId);
    if (!member) {
      throw AppError.notFound("MEMBER_NOT_FOUND", "Member not found in this organization");
    }

    if (member.role === "org_admin") {
      const adminCount = await memberRepository.countAdmins(organizationId);
      if (adminCount <= 1) {
        throw AppError.validation("Cannot remove the last remaining admin of an organization");
      }
    }

    await memberRepository.removeMember(organizationId, targetUserId);
  },
};
