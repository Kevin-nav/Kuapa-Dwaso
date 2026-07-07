# API

This app is for the NestJS API using TypeScript and the Fastify adapter.

The API should organize code by responsibility under folders such as modules, workflows, providers, guards, middleware, filters, pipes, config, and lib. Controllers should stay thin, product behavior belongs in workflows, and provider-specific code belongs in providers.

For local development, API env values are read from the repo root `.env.local`
first, then root `.env`. Deployment-provided environment variables still take
precedence and API secrets must not be mirrored into `NEXT_PUBLIC_*` variables.
