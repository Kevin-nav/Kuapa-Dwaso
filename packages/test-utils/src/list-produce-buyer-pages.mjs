import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucket = process.env.CLOUDFLARE_R2_BUCKET;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error("Cloudflare R2 environment variables are missing.");
}

async function run() {
  console.log("Connecting to Convex at:", convexUrl);
  const client = new ConvexHttpClient(convexUrl);

  const adminUserId = "ks78t91c8ny38ykv3qd6gm7t0x8a8nv1";
  const agentUserId = "ks78zz9gmtsd2nvs5rsj28r34s8a8rs1"; // Kevin Amisom
  const farmerId = "k57c5hhf139grn5jtdazgwhw5n8a8yj6"; // Osei Andrews
  const warehouseId = "n975rc8jgmhhp475n1mt63vg358a93w3"; // Tarkwa Community Store

  // 1. Update the warehouse destination markets served to serve "Tarkwa"
  console.log(`Updating warehouse ${warehouseId} destinationMarketsServed...`);
  await client.mutation(api.warehouses.update, {
    actorUserId: adminUserId,
    warehouseId: warehouseId,
    destinationMarketsServed: ["Tarkwa Market", "Takoradi Market", "Tarkwa"]
  });
  console.log("Warehouse updated successfully.");

  // 2. Read the image file
  const imagePath = resolve(rootDir, "apps/app/app/public/photo_2026-07-10_22-53-56.jpg");
  console.log(`Reading image file from ${imagePath}...`);
  const fileBuffer = readFileSync(imagePath);
  const sizeBytes = fileBuffer.length;
  const fileName = "photo_2026-07-10_22-53-56.jpg";
  const contentType = "image/jpeg";

  // 3. Create pending upload in Convex
  console.log("Creating pending upload asset in Convex...");
  const pending = await client.mutation(api.uploads.createPending, {
    actorUserId: adminUserId,
    ownerUserId: adminUserId,
    ownerProfileType: "admin",
    purpose: "produce_intake_photo",
    contentType,
    sizeBytes,
    bucket,
    fileName,
  });
  const { uploadAssetId, objectKey } = pending;
  console.log(`Pending upload created. Asset ID: ${uploadAssetId}, Object Key: ${objectKey}`);

  // 4. Upload file to R2
  console.log("Uploading file to Cloudflare R2...");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: fileBuffer,
    ContentType: contentType,
  }));
  console.log("File uploaded successfully to R2.");

  // 5. Complete upload in Convex
  console.log("Completing upload asset in Convex...");
  await client.mutation(api.uploads.complete, {
    actorUserId: adminUserId,
    uploadAssetId,
    sizeBytes,
  });
  console.log("Upload asset completed.");

  // 6. Create Intake/Produce batch
  console.log("Creating intake batch in Convex...");
  const sellByDate = Date.now() + 120 * 24 * 60 * 60 * 1000;
  const batchId = await client.mutation(api.inventoryBatches.createIntake, {
    actorUserId: agentUserId,
    farmerId,
    warehouseId,
    cropType: "Maize",
    variety: "White Dent Maize",
    quantityReceived: 150,
    unit: "bags",
    grade: "A",
    photos: [uploadAssetId],
    conditionNotes: "Excellent dry Maize stock ready for purchase.",
    expectedShelfLifeDays: 120,
    sellByDate,
    askingPricePerUnit: 180,
    minimumPricePerUnit: 160,
    status: "available",
  });

  console.log(`Intake batch created successfully. Batch ID: ${batchId}`);
}

run().catch((error) => {
  console.error("Failed to seed and list produce:", error);
  process.exit(1);
});
