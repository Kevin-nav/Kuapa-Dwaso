export type MarketplaceAudience = "public" | "farmer" | "buyer" | "agent" | "admin";

export type HealthStatus = "ok";

export type HealthCheckResponse = {
  service: "api";
  status: HealthStatus;
};
