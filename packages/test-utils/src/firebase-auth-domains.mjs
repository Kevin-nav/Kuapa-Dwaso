export function parseFirebaseAuthOrigins(value) {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new Error("FIREBASE_AUTH_ORIGINS must contain at least one HTTPS origin.");
  }

  const hostnames = [];
  for (const entry of entries) {
    let parsed;
    try {
      parsed = new URL(entry);
    } catch {
      throw new Error(`Firebase auth origin is not a valid URL: ${entry}`);
    }

    if (parsed.protocol !== "https:") {
      throw new Error(`Firebase auth origin must use HTTPS: ${entry}`);
    }
    if (
      parsed.pathname !== "/" ||
      parsed.search.length > 0 ||
      parsed.hash.length > 0 ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      parsed.port.length > 0
    ) {
      throw new Error(`Firebase auth origin must be an origin without a path, query, credentials, or port: ${entry}`);
    }

    const hostname = normalizeDomain(parsed.hostname);
    if (!hostnames.includes(hostname)) {
      hostnames.push(hostname);
    }
  }

  return hostnames;
}

export function findMissingFirebaseAuthDomains(requiredDomains, authorizedDomains) {
  const authorized = new Set(authorizedDomains.map(normalizeDomain));
  return requiredDomains.map(normalizeDomain).filter((domain) => !authorized.has(domain));
}

export async function fetchFirebaseAuthorizedDomains(apiKey, fetchImplementation = fetch) {
  const endpoint = new URL("https://identitytoolkit.googleapis.com/v1/projects");
  endpoint.searchParams.set("key", apiKey);
  const response = await fetchImplementation(endpoint);
  if (!response.ok) {
    throw new Error(`Firebase project configuration request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.authorizedDomains)) {
    throw new Error("Firebase project configuration did not include authorizedDomains.");
  }

  return payload.authorizedDomains.filter((domain) => typeof domain === "string").map(normalizeDomain);
}

function normalizeDomain(domain) {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}
