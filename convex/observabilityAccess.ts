import type { MarketplaceRole } from "@kuapa-dwaso/types";
import type { Id } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";

export const marketplaceRoleValidatorValues = [
  "farmer",
  "warehouse_agent",
  "buyer",
  "transporter",
  "admin",
] as const;

export const auditEntityTypeValidatorValues = [
  "user",
  "farmer",
  "warehouse_agent",
  "warehouse",
  "inventory_batch",
  "storage_receipt",
  "inventory_reservation",
  "storage_fee_ledger",
  "storage_rate_rule",
  "fee_rule",
  "buyer",
  "buyer_order",
  "buyer_order_charge",
  "sale_record",
  "sale_deduction",
  "dispatch",
  "dispute",
  "notification",
  "app_setting",
] as const;

type RequestingRoleArgs = {
  requestingUserId?: Id<"users">;
  requestingActorRole?: MarketplaceRole;
};

type ActorRoleArgs = {
  actorUserId?: Id<"users">;
  actorRole: MarketplaceRole;
};

export async function resolveRequestingRole(
  db: DatabaseReader,
  args: RequestingRoleArgs,
): Promise<MarketplaceRole> {
  if (args.requestingUserId === undefined) {
    if (args.requestingActorRole === undefined) {
      throw new Error("Provide requestingUserId or requestingActorRole.");
    }

    return args.requestingActorRole;
  }

  const user = await db.get(args.requestingUserId);
  if (user === null) {
    throw new Error("Requesting user not found.");
  }

  if (user.status !== "active") {
    throw new Error("Requesting user is not active.");
  }

  if (
    args.requestingActorRole !== undefined &&
    args.requestingActorRole !== user.role
  ) {
    throw new Error("Requesting role does not match the user record.");
  }

  return user.role;
}

export async function assertActorRoleMatchesUser(
  db: DatabaseReader,
  args: ActorRoleArgs,
): Promise<void> {
  if (args.actorUserId === undefined) {
    return;
  }

  const user = await db.get(args.actorUserId);
  if (user === null) {
    throw new Error("Actor user not found.");
  }

  if (user.status !== "active") {
    throw new Error("Actor user is not active.");
  }

  if (user.role !== args.actorRole) {
    throw new Error("Actor role does not match the user record.");
  }
}
