# Network Performance Convention

The product must work well for users with slow or unreliable network access.

Stable rules:

1. Public pages stay lightweight.
2. Admin and dashboard code stays isolated from public pages.
3. Maps, charts, analytics, and heavy tables are lazy-loaded.
4. Shared packages avoid browser-heavy dependencies.
5. Images are optimized and compressed before upload where practical.
6. Agent forms support draft saving where practical.
7. Farmer-facing screens prefer simple lists, clear text, and low-image layouts.
8. External service failures produce clear recoverable states.
9. Paystack uses test mode for MVP and demo work.
10. SMS and webhook flows are mockable locally.
11. Payment workflows must remain provider-neutral in product code. Use
    `PAYMENT_PROVIDER=mock` for local and smoke tests, and keep Paystack secret
    keys API-only.

## Measurement

- Use `corepack pnpm benchmark:performance` against production builds for repeatable lab measurements.
- Compare the median of at least three runs under the same Lighthouse mobile profile.
- Track transferred bytes, Largest Contentful Paint, First Contentful Paint, Speed Index, Total Blocking Time, and request count.
- Use the named `standard`, `ghana`, `poor`, and `stress` profiles without silently changing their conditions.
- Cold-cache Lighthouse results and future persistent-browser warm-cache results must be labelled separately.
- Track failed requests, image transfer and completion, long tasks, and recovery behavior where the harness supports them.
- Treat lab percentages as engineering evidence, not a guarantee for every device or carrier.
- Keep future production Core Web Vitals separate from lab results so investor reporting distinguishes controlled benchmarks from real-user experience.
