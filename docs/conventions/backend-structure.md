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

Payment product flows depend on the API payment-provider seam, not on Paystack
directly. Paystack initialization, verification, and webhook signature handling
belong under `apps/api/src/providers/`; Convex stores provider-neutral payment
transactions, provider events, and payout ledger records. Farmer bank/mobile
money transfer automation is out of the MVP boundary until a separate payout
provider design is approved.

The demand-led maize pilot follows the same boundary. Convex owns pilot product
state, transitions, financial entries, access checks, and durable events. The
NestJS API verifies Firebase credentials for provider-facing calls and owns
provider SDK work for payments, SMS, and private uploads. It must not duplicate
pilot product state or accept a browser-supplied actor ID as authority. The exact
planned interfaces are frozen in
[`maize-pilot-contracts.md`](../technical/maize-pilot-contracts.md).
