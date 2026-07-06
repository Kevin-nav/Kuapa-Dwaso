/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as buyerOrders from "../buyerOrders.js";
import type * as buyers from "../buyers.js";
import type * as dispatches from "../dispatches.js";
import type * as disputes from "../disputes.js";
import type * as farmers from "../farmers.js";
import type * as feeRules from "../feeRules.js";
import type * as health from "../health.js";
import type * as hotspots from "../hotspots.js";
import type * as inventoryBatches from "../inventoryBatches.js";
import type * as notifications from "../notifications.js";
import type * as observabilityAccess from "../observabilityAccess.js";
import type * as sales from "../sales.js";
import type * as storageFees from "../storageFees.js";
import type * as transporters from "../transporters.js";
import type * as users from "../users.js";
import type * as warehouseAgents from "../warehouseAgents.js";
import type * as warehouses from "../warehouses.js";
import type * as workflowHelpers from "../workflowHelpers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  buyerOrders: typeof buyerOrders;
  buyers: typeof buyers;
  dispatches: typeof dispatches;
  disputes: typeof disputes;
  farmers: typeof farmers;
  feeRules: typeof feeRules;
  health: typeof health;
  hotspots: typeof hotspots;
  inventoryBatches: typeof inventoryBatches;
  notifications: typeof notifications;
  observabilityAccess: typeof observabilityAccess;
  sales: typeof sales;
  storageFees: typeof storageFees;
  transporters: typeof transporters;
  users: typeof users;
  warehouseAgents: typeof warehouseAgents;
  warehouses: typeof warehouses;
  workflowHelpers: typeof workflowHelpers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
