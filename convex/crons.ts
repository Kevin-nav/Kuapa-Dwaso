import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("market run and reservation deadline reminders", { hours: 1 }, internal.deadlineNotifications.run, {});
crons.interval("market run cutoff recovery", { hours: 1 }, internal.marketDeliveryRuns.advanceExpiredCutoffs, {});
crons.interval("reservation expiry recovery", { hours: 1 }, internal.buyerOrders.expireDueReservations, {});

export default crons;
