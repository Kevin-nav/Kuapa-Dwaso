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

const confirmed = process.argv.includes("--confirm");
if (!confirmed) {
  throw new Error(
    "Pass --confirm to seed the permanent staging platform owner.",
  );
}

const ownerEmail = requireValue("PLATFORM_OWNER_EMAIL").trim().toLowerCase();
const ownerName = requireValue("PLATFORM_OWNER_NAME").trim();
const ownerPhoneNumber = optionalValue("PLATFORM_OWNER_PHONE_NUMBER");
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

const firebaseUser = await getAuth(firebaseApp).getUserByEmail(ownerEmail);
if (firebaseUser.disabled) {
  throw new Error("The Firebase platform-owner account is disabled.");
}
if (!firebaseUser.emailVerified) {
  throw new Error(
    "Verify the platform owner's Firebase email before seeding Convex access.",
  );
}

const authMethods = firebaseUser.providerData.some(
  (provider) => provider.providerId === "google.com",
)
  ? ["google"]
  : firebaseUser.providerData.some(
        (provider) => provider.providerId === "password",
      )
    ? ["email_password"]
    : [];
if (authMethods.length === 0) {
  throw new Error(
    "The platform owner must have Google or email/password Firebase authentication.",
  );
}

const mfaFactors = firebaseUser.multiFactor?.enrolledFactors ?? [];
if (!mfaFactors.some((factor) => factor.factorId === "totp")) {
  throw new Error(
    "Enroll a Firebase TOTP authenticator factor before seeding platform-owner access.",
  );
}

const client = new ConvexHttpClient(convexUrl);
const userArgs = {
  authProviderId: firebaseUser.uid,
  authProvider: "firebase",
  email: ownerEmail,
  name: ownerName,
  role: "admin",
  status: "active",
  authMethods,
  emailVerified: true,
  mfaRequirement: "totp_required",
  mfaStatus: "verified",
};
if (ownerPhoneNumber !== undefined) {
  userArgs.phoneNumber = ownerPhoneNumber;
  userArgs.phoneVerified = firebaseUser.phoneNumber === ownerPhoneNumber;
}

const adminUserId = await client.mutation(
  api.users.upsertProfileByAuthProviderId,
  userArgs,
);
try {
  await client.mutation(api.adminAccess.bootstrapFirstPlatformOwner, {
    adminUserId,
    reason:
      "Permanent staging platform owner bootstrap after verified Google/email and TOTP enrollment",
  });
} catch (error) {
  if (
    !String(error?.message ?? error).includes("platform owner already exists")
  ) {
    throw error;
  }
}

const access = await client.query(api.adminAccess.getEffectiveAccess, {
  actorUserId: adminUserId,
  adminUserId,
});
if (access.isPlatformOwner !== true) {
  throw new Error(
    "The seeded user does not have effective platform-owner access.",
  );
}

console.log(
  JSON.stringify(
    {
      email: ownerEmail,
      userId: adminUserId,
      role: "platform_owner",
      scope: "global",
      expiresAt: null,
      mfaRequirement: "totp_required",
      permissions: access.permissions.length,
    },
    null,
    2,
  ),
);

function requireValue(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalValue(name) {
  const value = process.env[name]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}
