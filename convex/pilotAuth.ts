import { query } from "./_generated/server";
import { getEffectiveAdminAccess } from "./workflowHelpers";
import { requirePilotPrincipal } from "./pilotAccess";

export const currentPrincipal = query({
  args: {},
  handler: async (ctx) => {
    const principal = await requirePilotPrincipal(ctx);
    const now = Date.now();
    const [profileLinks, assignments] = await Promise.all([
      ctx.db
        .query("profileLinks")
        .withIndex("by_user_status", (query) =>
          query.eq("userId", principal._id).eq("status", "linked"),
        )
        .collect(),
      ctx.db
        .query("pilotAssignments")
        .withIndex("by_user_status", (query) =>
          query.eq("userId", principal._id).eq("status", "active"),
        )
        .collect(),
    ]);
    const activeAssignments = assignments
      .filter(
        (assignment) =>
          assignment.expiresAt === undefined || assignment.expiresAt > now,
      )
      .map((assignment) => ({
        assignmentId: assignment._id,
        programmeId: assignment.programmeId,
        capabilities: assignment.capabilities,
        expiresAt: assignment.expiresAt,
      }));
    const adminAccess =
      principal.role === "admin"
        ? await getEffectiveAdminAccess(ctx, principal._id)
        : undefined;
    return {
      userId: principal._id,
      role: principal.role,
      name: principal.name,
      profiles: profileLinks.map((link) => ({
        profileType: link.profileType,
        profileId: link.profileId,
      })),
      activeAssignments,
      adminPilotGrants:
        adminAccess?.grants
          .filter(
            (grant) =>
              grant.scopeType === "global" ||
              grant.scopeType === "pilot_programme",
          )
          .map((grant) => ({
            roleKey: grant.roleKey,
            scopeType: grant.scopeType,
            scopeId: grant.scopeId,
            permissions: grant.permissions.filter((permission) =>
              permission.startsWith("pilot"),
            ),
            expiresAt: grant.expiresAt,
          })) ?? [],
    };
  },
});
