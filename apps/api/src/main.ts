import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import "reflect-metadata";
import { AppModule } from "./app.module.js";
import { getApiEnvironment } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const env = getApiEnvironment();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: ["error", "warn", "log"]
  });

  await app.listen({ host: "0.0.0.0", port: env.port });
}

void bootstrap();
