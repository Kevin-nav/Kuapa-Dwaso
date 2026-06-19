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

