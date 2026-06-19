import { Controller, Get } from "@nestjs/common";
import type { HealthCheckResponse } from "@agriculture/types";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthCheckResponse {
    return {
      service: "api",
      status: "ok"
    };
  }
}
