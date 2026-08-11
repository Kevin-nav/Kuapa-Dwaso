import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export type ClientActionKind =
  | "farmer_dispute_create"
  | "ops_farmer_register"
  | "ops_intake_create"
  | "ops_dispute_create"
  | "transporter_dispatch_status"
  | "transporter_proof_upload";

export async function previousClientActionResult(ctx: MutationCtx, actorUserId: Id<"users">, clientActionId?: string) {
  if (clientActionId === undefined) return undefined;
  return await ctx.db.query("clientActionReceipts").withIndex("by_actor_client_action", (q) => q.eq("actorUserId", actorUserId).eq("clientActionId", clientActionId)).unique();
}

export async function recordClientAction(ctx: MutationCtx, input: { actorUserId: Id<"users">; clientActionId: string | undefined; actionKind: ClientActionKind; resultEntityId?: string }) {
  if (input.clientActionId === undefined) return;
  await ctx.db.insert("clientActionReceipts", {
    actorUserId: input.actorUserId,
    clientActionId: input.clientActionId,
    actionKind: input.actionKind,
    ...(input.resultEntityId === undefined ? {} : { resultEntityId: input.resultEntityId }),
    completedAt: Date.now(),
  });
}
