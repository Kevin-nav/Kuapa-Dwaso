export type ApiEnvironment = {
  nodeEnv: string;
  port: number;
  auth: {
    convexUrl?: string;
    firebaseProjectId?: string;
    firebaseServiceAccountJson?: string;
    disabled: boolean;
  };
};

const defaultPort = 4000;

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return defaultPort;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultPort;
}

export function getApiEnvironment(): ApiEnvironment {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const auth: ApiEnvironment["auth"] = {
    disabled: process.env.API_AUTH_DISABLED === "true" && nodeEnv !== "production"
  };

  if (process.env.FIREBASE_PROJECT_ID !== undefined) {
    auth.firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON !== undefined) {
    auth.firebaseServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  }

  if (process.env.CONVEX_URL !== undefined) {
    auth.convexUrl = process.env.CONVEX_URL;
  }

  return {
    nodeEnv,
    port: parsePort(process.env.PORT),
    auth
  };
}
