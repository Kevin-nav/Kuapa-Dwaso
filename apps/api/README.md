# API

This app is for the NestJS API using TypeScript and the Fastify adapter.

The API should organize code by responsibility under folders such as modules, workflows, providers, guards, middleware, filters, pipes, config, and lib. Controllers should stay thin, product behavior belongs in workflows, and provider-specific code belongs in providers.

For local development, API env values are read from the repo root `.env.local`
first, then root `.env`. Deployment-provided environment variables still take
precedence and API secrets must not be mirrored into `NEXT_PUBLIC_*` variables.

## Temporary preview access

`POST /preview-access/session` exchanges a closed public role for a Firebase
custom token. The endpoint stays unavailable unless `PREVIEW_ACCESS_ENABLED`
is exactly `true` and `PREVIEW_ACCESS_CUTOFF_UTC` is a future ISO 8601 UTC
timestamp.

Configure each role with an existing Firebase user ID on the API only:

```text
PREVIEW_ACCESS_FARMER_FIREBASE_UID
PREVIEW_ACCESS_BUYER_FIREBASE_UID
PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID
PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID
```

`API_RATE_LIMIT_PREVIEW_SESSION_MAX` sets the number of session requests each
client may make during `API_RATE_LIMIT_WINDOW_MS`. Turning the endpoint off does
not revoke Firebase sessions already issued to the shared accounts. Revoke
their refresh tokens when the preview closes.
