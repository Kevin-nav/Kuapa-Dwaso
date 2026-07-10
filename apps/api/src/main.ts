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

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || env.cors.allowedOrigins.includes(origin) || env.cors.allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
  });

  await app.listen({ host: "0.0.0.0", port: env.port });
}

void bootstrap();
