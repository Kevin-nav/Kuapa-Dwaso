/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as adminAccess from "../adminAccess.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as blogPosts from "../blogPosts.js";
import type * as buyerOrders from "../buyerOrders.js";
import type * as buyers from "../buyers.js";
import type * as clientActions from "../clientActions.js";
import type * as crons from "../crons.js";
import type * as deadlineNotifications from "../deadlineNotifications.js";
import type * as dispatches from "../dispatches.js";
import type * as disputes from "../disputes.js";
import type * as farmers from "../farmers.js";
import type * as feeRules from "../feeRules.js";
import type * as health from "../health.js";
import type * as hotspots from "../hotspots.js";
import type * as inventoryBatches from "../inventoryBatches.js";
import type * as invitations from "../invitations.js";
import type * as marketDeliveryRuns from "../marketDeliveryRuns.js";
import type * as marketServiceSchedules from "../marketServiceSchedules.js";
import type * as notificationServiceAuth from "../notificationServiceAuth.js";
import type * as notifications from "../notifications.js";
import type * as observabilityAccess from "../observabilityAccess.js";
import type * as payments from "../payments.js";
import type * as paymentServiceAuth from "../paymentServiceAuth.js";
import type * as pilotAccess from "../pilotAccess.js";
import type * as pilotAllocations from "../pilotAllocations.js";
import type * as pilotAssignments from "../pilotAssignments.js";
import type * as pilotAuth from "../pilotAuth.js";
import type * as pilotFulfilment from "../pilotFulfilment.js";
import type * as pilotFinance from "../pilotFinance.js";
import type * as pilotIdempotency from "../pilotIdempotency.js";
import type * as pilotInspections from "../pilotInspections.js";
import type * as pilotLots from "../pilotLots.js";
import type * as pilotOffers from "../pilotOffers.js";
import type * as pilotOrders from "../pilotOrders.js";
import type * as pilotProcurement from "../pilotProcurement.js";
import type * as pilotProgrammes from "../pilotProgrammes.js";
import type * as pilotRequests from "../pilotRequests.js";
import type * as pilotSchema from "../pilotSchema.js";
import type * as pilotSupply from "../pilotSupply.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as sales from "../sales.js";
import type * as seedFirstBlog from "../seedFirstBlog.js";
import type * as seedSecondBlog from "../seedSecondBlog.js";
import type * as seedWesternRegions from "../seedWesternRegions.js";
import type * as smokeCleanup from "../smokeCleanup.js";
import type * as smsDeliveries from "../smsDeliveries.js";
import type * as storageFees from "../storageFees.js";
import type * as transporters from "../transporters.js";
import type * as uploads from "../uploads.js";
import type * as users from "../users.js";
import type * as warehouseAgents from "../warehouseAgents.js";
import type * as warehouses from "../warehouses.js";
import type * as webPushDeliveries from "../webPushDeliveries.js";
import type * as workflowHelpers from "../workflowHelpers.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminAccess: typeof adminAccess;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  blogPosts: typeof blogPosts;
  buyerOrders: typeof buyerOrders;
  buyers: typeof buyers;
  clientActions: typeof clientActions;
  crons: typeof crons;
  deadlineNotifications: typeof deadlineNotifications;
  dispatches: typeof dispatches;
  disputes: typeof disputes;
  farmers: typeof farmers;
  feeRules: typeof feeRules;
  health: typeof health;
  hotspots: typeof hotspots;
  inventoryBatches: typeof inventoryBatches;
  invitations: typeof invitations;
  marketDeliveryRuns: typeof marketDeliveryRuns;
  marketServiceSchedules: typeof marketServiceSchedules;
  notificationServiceAuth: typeof notificationServiceAuth;
  notifications: typeof notifications;
  observabilityAccess: typeof observabilityAccess;
  payments: typeof payments;
  paymentServiceAuth: typeof paymentServiceAuth;
  pilotAccess: typeof pilotAccess;
  pilotAllocations: typeof pilotAllocations;
  pilotAssignments: typeof pilotAssignments;
  pilotAuth: typeof pilotAuth;
  pilotFulfilment: typeof pilotFulfilment;
  pilotFinance: typeof pilotFinance;
  pilotIdempotency: typeof pilotIdempotency;
  pilotInspections: typeof pilotInspections;
  pilotLots: typeof pilotLots;
  pilotOffers: typeof pilotOffers;
  pilotOrders: typeof pilotOrders;
  pilotProcurement: typeof pilotProcurement;
  pilotProgrammes: typeof pilotProgrammes;
  pilotRequests: typeof pilotRequests;
  pilotSchema: typeof pilotSchema;
  pilotSupply: typeof pilotSupply;
  pushSubscriptions: typeof pushSubscriptions;
  sales: typeof sales;
  seedFirstBlog: typeof seedFirstBlog;
  seedSecondBlog: typeof seedSecondBlog;
  seedWesternRegions: typeof seedWesternRegions;
  smokeCleanup: typeof smokeCleanup;
  smsDeliveries: typeof smsDeliveries;
  storageFees: typeof storageFees;
  transporters: typeof transporters;
  uploads: typeof uploads;
  users: typeof users;
  warehouseAgents: typeof warehouseAgents;
  warehouses: typeof warehouses;
  webPushDeliveries: typeof webPushDeliveries;
  workflowHelpers: typeof workflowHelpers;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
export declare const components: {};
