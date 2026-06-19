# Backend Structure Convention

The API app uses NestJS with TypeScript and the Fastify adapter.

API code should be organized by responsibility under `apps/api/src/`:

```text
modules/
workflows/
providers/
guards/
middleware/
filters/
pipes/
config/
lib/
```

The folder responsibilities are strict, but exact filenames are allowed to evolve.

Controllers should stay thin. Product behavior belongs in workflows. Provider-specific code belongs in providers. Shared domain rules belong in shared packages.

