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

const projectId = requireValue("FIREBASE_PROJECT_ID");
const serviceAccountBase64 = requireValue(
  "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
);
const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountBase64, "base64").toString("utf8"),
);
const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });

const uid = "D3ZorCL1JkXrWXeR7ubuUCUcYwE2";
const displayName = "Kevin Amisom";
const phoneNumber = "+233549037907";

async function run() {
  console.log(`Checking/updating Firebase user ${uid}...`);
  const auth = getAuth(firebaseApp);
  let firebaseUser = await auth.getUser(uid);

  if (firebaseUser.displayName !== displayName) {
    console.log(`Updating Firebase displayName to "${displayName}"...`);
    firebaseUser = await auth.updateUser(uid, { displayName });
    console.log("Firebase user updated successfully.");
  } else {
    console.log("Firebase user displayName is already correct.");
  }

  console.log("Connecting to Convex at:", convexUrl);
  const client = new ConvexHttpClient(convexUrl);

  // 1. Upsert the User Profile in Convex
  console.log("Upserting Convex user profile...");
  const userId = await client.mutation(api.users.upsertProfileByAuthProviderId, {
    authProviderId: uid,
    authProvider: "firebase",
    name: displayName,
    phoneNumber: phoneNumber,
    role: "warehouse_agent",
    status: "active",
    authMethods: ["phone"],
    phoneVerified: true,
    emailVerified: false,
    mfaRequirement: "not_required",
    mfaStatus: "not_required"
  });
  console.log(`Convex user profile upserted. ID: ${userId}`);

  // 2. Create the Warehouse Agent Record in Convex
  console.log("Creating Convex warehouse agent profile...");
  // Using the admin actor ID found in Convex staging database
  const actorUserId = "ks78t91c8ny38ykv3qd6gm7t0x8a8nv1"; 
  
  const agentId = await client.mutation(api.warehouseAgents.create, {
    actorUserId: actorUserId,
    userId: userId,
    fullName: displayName,
    phoneNumber: phoneNumber,
    assignedWarehouseIds: [],
    status: "approved"
  });

  console.log(`Convex warehouse agent profile created successfully. ID: ${agentId}`);

  // 3. Verify
  console.log("Verifying Convex database records...");
  const checkUser = await client.query(api.users.getById, { userId });
  console.log("Verified User Profile in Convex:", checkUser);

  const checkAgent = await client.query(api.warehouseAgents.getByUser, {
    actorUserId: actorUserId,
    userId: userId,
  });
  console.log("Verified Warehouse Agent in Convex:", checkAgent);
}

run().catch((error) => {
  console.error("Failed to seed warehouse agent:", error);
  process.exit(1);
});

function requireValue(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
