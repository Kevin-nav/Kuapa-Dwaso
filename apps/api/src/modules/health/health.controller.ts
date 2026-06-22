import { Controller, Get } from "@nestjs/common";
import type { HealthCheckResponse } from "@kuapa-dwaso/types";

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
