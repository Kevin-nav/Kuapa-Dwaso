import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import "reflect-metadata";
import { AppModule } from "./app.module.js";
import { getApiEnvironment } from "./config/env.js";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter.js";

async function bootstrap(): Promise<void> {
  const env = getApiEnvironment();
  const adapter = new FastifyAdapter({ bodyLimit: env.uploads.maxSizeBytes + 1024 });
  adapter.getInstance().addContentTypeParser(
    ["image/jpeg", "image/png", "image/webp"],
    { parseAs: "buffer" },
    (_request, body, done) => done(null, body),
  );
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: ["error", "warn", "log"]
  });

  app.useGlobalFilters(new AllExceptionsFilter());

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
