import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("market run and reservation deadline reminders", { hours: 1 }, internal.deadlineNotifications.run, {});

export default crons;
