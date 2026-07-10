import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";

const rootDir = resolve(import.meta.dirname, "../../..");
const stagingEnvPath = resolve(rootDir, ".env.staging");
if (existsSync(stagingEnvPath)) {
  loadEnvFile(stagingEnvPath);
}

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl === undefined || convexUrl.trim().length === 0) {
  throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is required.");
}

const client = new ConvexHttpClient(convexUrl);

try {
  console.log("Listing some active admin users...");
  // Let's use a query or custom script. Wait, does Convex have a query for listing users or admins?
  // Let's check api.adminAccess or api.users.
  // Wait, let's look at convex/admin.ts or convex/users.ts to see what queries we can use.
  // In convex/users.ts or similar, is there a query to list users?
  // Let's print the available fields/endpoints of api.
  console.log("Keys of api:", Object.keys(api));
  console.log("Keys of api.users:", Object.keys(api.users));
  console.log("Keys of api.adminAccess:", Object.keys(api.adminAccess));
} catch (e) {
  console.error("Error:", e);
}
