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

  console.log("Querying available inventory summaries for Tarkwa...");
  try {
    const summaries = await client.query(api.buyerOrders.summarizeAvailableInventory, {
      destinationMarket: "Tarkwa"
    });
    console.log("Summaries for Tarkwa:", JSON.stringify(summaries, null, 2));

    const batches = await client.query(api.buyerOrders.listAvailableInventory, {
      warehouseId: "n975rc8jgmhhp475n1mt63vg358a93w3",
      cropType: "Maize",
      grade: "A",
      destinationMarket: "Tarkwa"
    });
    console.log("Batches for Tarkwa:", JSON.stringify(batches, null, 2));
  } catch (err) {
    console.error("Failed to query summaries/batches:", err.message);
  }
}

run().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
