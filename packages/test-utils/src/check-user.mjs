import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
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

async function run() {
  const client = new ConvexHttpClient(convexUrl);
  const actorUserId = "ks78zz9gmtsd2nvs5rsj28r34s8a8rs1"; // Kevin Amisom
  const phoneNumber = "+233533200143"; // Osei Andrews

  console.log(`Querying getByPhoneNumber with actorUserId=${actorUserId} and phoneNumber=${phoneNumber}...`);
  try {
    const result = await client.query(api.farmers.getByPhoneNumber, {
      actorUserId,
      phoneNumber
    });
    console.log("Query returned:", result);
  } catch (error) {
    console.error("Query failed with error:", error);
  }
}

run();
