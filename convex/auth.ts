import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getActor, type Actor } from "./workflowHelpers";

export async function resolveActor(ctx: QueryCtx | MutationCtx, actorUserId: Id<"users">): Promise<Actor> {
  return await getActor(ctx, actorUserId);
}
