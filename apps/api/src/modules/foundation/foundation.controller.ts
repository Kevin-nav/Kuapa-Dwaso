import { Controller, Get } from "@nestjs/common";

@Controller("foundation")
export class FoundationController {
  @Get("readiness")
  getReadiness(): { service: "api"; foundation: "ready" } {
    return {
      service: "api",
      foundation: "ready"
    };
  }
}
