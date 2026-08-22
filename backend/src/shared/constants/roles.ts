export const ORG_ROLES = ["org_admin", "member"] as const;
export type OrgRoleName = (typeof ORG_ROLES)[number];
