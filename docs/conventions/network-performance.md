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
12. The self-service, warehouse-operations, and admin origins are separate PWAs;
    the public site must not import their service-worker or install UI code.
13. Service workers cache only shell documents, immutable static assets, and
    allowlisted public images. Authentication, payments, APIs, Convex, uploads,
    RSC flight responses, and signed private media are network-only.
14. Private browser storage is versioned and account-bound. It is cleared on
    sign-out/account change, limited by age and count, and never stores tokens.
15. Offline mutation queues synchronize in the foreground and must use server
    idempotency plus conflict validation. Background Sync is not a product guarantee.

## Measurement

- Use `corepack pnpm benchmark:performance` against production builds for repeatable lab measurements.
- Compare the median of at least three runs under the same Lighthouse mobile profile.
- Track transferred bytes, Largest Contentful Paint, First Contentful Paint, Speed Index, Total Blocking Time, and request count.
- Use the named `standard`, `ghana`, `poor`, and `stress` profiles without silently changing their conditions.
- Cold-cache Lighthouse results and future persistent-browser warm-cache results must be labelled separately.
- PWA comparisons must report service-worker-controlled warm-cache runs separately
  from cold first visits and include offline launch/recovery behavior.
- Track failed requests, image transfer and completion, long tasks, and recovery behavior where the harness supports them.
- Treat lab percentages as engineering evidence, not a guarantee for every device or carrier.
- Keep future production Core Web Vitals separate from lab results so investor reporting distinguishes controlled benchmarks from real-user experience.
