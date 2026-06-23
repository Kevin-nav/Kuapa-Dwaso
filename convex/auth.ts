import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function resolveActor(ctx: QueryCtx | MutationCtx, actorUserId: Id<"users">): Promise<Doc<"users">> {
  const actor = await ctx.db.get(actorUserId);

  if (actor === null) {
    throw new Error("Actor user was not found.");
  }

  return actor;
}
