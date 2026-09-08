import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { assertAllowed } from "./workflowHelpers";

export type PilotEntityType =
  Doc<"pilotIdempotencyKeys">["resultRefs"][number]["entityType"];

type PilotIdempotencyInput = {
  programmeId: Id<"pilotProgrammes">;
  actorUserId: Id<"users">;
  operationName: string;
  idempotencyKey: string;
  requestHash: string;
};

export async function getPilotIdempotencyReplay(
  ctx: MutationCtx,
  input: PilotIdempotencyInput,
): Promise<Doc<"pilotIdempotencyKeys"> | null> {
  assertAllowed(
    input.idempotencyKey.trim().length >= 8,
    "Idempotency key must contain at least 8 characters.",
  );
  const existing = await ctx.db
    .query("pilotIdempotencyKeys")
    .withIndex("by_actor_operation_key", (query) =>
      query
        .eq("actorUserId", input.actorUserId)
        .eq("operationName", input.operationName)
        .eq("idempotencyKey", input.idempotencyKey),
    )
    .unique();
  if (existing === null) return null;
  assertAllowed(
    existing.programmeId === input.programmeId,
    "Idempotency key belongs to another programme.",
  );
  assertAllowed(
    existing.requestHash === input.requestHash,
    "Idempotency key was already used with a different payload.",
  );
  assertAllowed(
    existing.status === "completed",
    "The original idempotent operation has not completed.",
  );
  return existing;
}

export async function beginPilotIdempotency(
  ctx: MutationCtx,
  input: PilotIdempotencyInput,
): Promise<
  | { kind: "started"; receiptId: Id<"pilotIdempotencyKeys"> }
  | { kind: "replay"; receipt: Doc<"pilotIdempotencyKeys"> }
> {
  assertAllowed(
    input.idempotencyKey.trim().length >= 8,
    "Idempotency key must contain at least 8 characters.",
  );
  const existing = await ctx.db
    .query("pilotIdempotencyKeys")
    .withIndex("by_actor_operation_key", (query) =>
      query
        .eq("actorUserId", input.actorUserId)
        .eq("operationName", input.operationName)
        .eq("idempotencyKey", input.idempotencyKey),
    )
    .unique();
  if (existing !== null) {
    assertAllowed(
      existing.programmeId === input.programmeId,
      "Idempotency key belongs to another programme.",
    );
    assertAllowed(
      existing.requestHash === input.requestHash,
      "Idempotency key was already used with a different payload.",
    );
    assertAllowed(
      existing.status === "completed",
      "The original idempotent operation has not completed.",
    );
    return { kind: "replay", receipt: existing };
  }
  const receiptId = await ctx.db.insert("pilotIdempotencyKeys", {
    programmeId: input.programmeId,
    actorUserId: input.actorUserId,
    operationName: input.operationName,
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    status: "started",
    resultRefs: [],
    createdAt: Date.now(),
  });
  return { kind: "started", receiptId };
}

export async function completePilotIdempotency(
  ctx: MutationCtx,
  receiptId: Id<"pilotIdempotencyKeys">,
  resultRefs: Array<{ entityType: PilotEntityType; entityId: string }>,
): Promise<void> {
  await ctx.db.patch(receiptId, {
    status: "completed",
    resultRefs,
    completedAt: Date.now(),
  });
}

export function replayEntityId<TableName extends TableNames>(
  receipt: Doc<"pilotIdempotencyKeys">,
  entityType: PilotEntityType,
): Id<TableName> {
  const reference = receipt.resultRefs.find(
    (candidate) => candidate.entityType === entityType,
  );
  assertAllowed(
    reference !== undefined,
    "Idempotent result reference is missing.",
  );
  return reference.entityId as Id<TableName>;
}
