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

  console.log("Listing all warehouses in Convex...");
  const warehouses = await client.query(api.warehouses.list, {});
  const warehouseIds = warehouses.map(w => w._id);
  console.log(`Found ${warehouses.length} warehouses:`, warehouses.map(w => `${w.name} (${w._id})`));

  const actorUserId = "ks78t91c8ny38ykv3qd6gm7t0x8a8nv1";
  const warehouseAgentId = "n576y6anmxppthg5wz365s7d1n8a90ed";

  console.log(`Assigning agent ${warehouseAgentId} to all ${warehouseIds.length} warehouses...`);
  await client.mutation(api.warehouseAgents.assignWarehouses, {
    actorUserId,
    warehouseAgentId,
    assignedWarehouseIds: warehouseIds
  });

  console.log("Verifying assignment...");
  const updatedAgent = await client.query(api.warehouseAgents.getById, {
    actorUserId,
    warehouseAgentId
  });

  console.log("Updated agent details:", {
    fullName: updatedAgent.fullName,
    assignedWarehouseIds: updatedAgent.assignedWarehouseIds
  });
}

run().catch((error) => {
  console.error("Failed to assign warehouses:", error);
  process.exit(1);
});
