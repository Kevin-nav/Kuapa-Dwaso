import type { MarketplaceRole } from "@kuapa-dwaso/types";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type Actor = Doc<"users"> & { role: MarketplaceRole };

export function assertAllowed(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function cleanOptionalText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned === undefined || cleaned.length === 0 ? undefined : cleaned;
}

export function auditSnapshot(value: Record<string, unknown>): Record<string, unknown> {
  return value;
}

export function normalizeCodeSegment(value: string | number, maxLength: number): string {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, maxLength);
}

export async function getActor(ctx: QueryCtx | MutationCtx, actorUserId: Id<"users">): Promise<Actor> {
  const actor = await ctx.db.get(actorUserId);
  assertAllowed(actor !== null, "Actor user was not found.");
  assertAllowed(
    actor.status !== "suspended" && actor.status !== "rejected" && actor.status !== "deactivated",
    "Actor user cannot perform marketplace actions."
  );

  return actor;
}

export async function insertAuditLog(
  ctx: MutationCtx,
  args: {
    actor: Actor;
    action: string;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown> | undefined;
    after?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | undefined;
  }
): Promise<void> {
  const auditLog: {
    actorId: string;
    actorRole: MarketplaceRole;
    action: string;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt: number;
  } = {
    actorId: args.actor._id,
    actorRole: args.actor.role,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    createdAt: Date.now()
  };

  if (args.before !== undefined) {
    auditLog.before = args.before;
  }
  if (args.after !== undefined) {
    auditLog.after = args.after;
  }
  if (args.metadata !== undefined) {
    auditLog.metadata = args.metadata;
  }

  await ctx.db.insert("auditLogs", auditLog);
}
