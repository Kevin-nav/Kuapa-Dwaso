import {
  fetchFirebaseAuthorizedDomains,
  findMissingFirebaseAuthDomains,
  parseFirebaseAuthOrigins,
} from "./firebase-auth-domains.mjs";

try {
  const apiKey = requiredEnvironmentValue("NEXT_PUBLIC_FIREBASE_API_KEY");
  const requiredDomains = parseFirebaseAuthOrigins(requiredEnvironmentValue("FIREBASE_AUTH_ORIGINS"));
  const authorizedDomains = await fetchFirebaseAuthorizedDomains(apiKey);
  const missingDomains = findMissingFirebaseAuthDomains(requiredDomains, authorizedDomains);

  if (missingDomains.length > 0) {
    throw new Error(`Firebase does not authorize: ${missingDomains.join(", ")}`);
  }

  console.log(`Firebase authorizes all required authentication domains: ${requiredDomains.join(", ")}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Firebase authorized-domain check failed.");
  process.exitCode = 1;
}

function requiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for the Firebase authorized-domain check.`);
  }
  return value;
}
