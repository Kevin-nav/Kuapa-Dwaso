export type ApiEnvironment = {
  nodeEnv: string;
  port: number;
  firebaseAuthDisabled: boolean;
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

  return {
    nodeEnv,
    port: parsePort(process.env.PORT),
    firebaseAuthDisabled: process.env.API_AUTH_DISABLED === "true" && nodeEnv !== "production"
  };
}
