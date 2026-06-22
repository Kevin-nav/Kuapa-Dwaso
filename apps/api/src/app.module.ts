import { Module } from "@nestjs/common";
import { FoundationModule } from "./modules/foundation/foundation.module.js";
import { HealthModule } from "./modules/health/health.module.js";

@Module({
  imports: [HealthModule, FoundationModule]
})
export class AppModule {}
