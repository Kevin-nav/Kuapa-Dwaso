# Kuapa Dwaso documentation

This is the entry point for the project documentation. It separates the current product and engineering references from the historical plans that explain how the product evolved.

## Start here

- [Product guide](product/overview.md) — a non-technical explanation of the product, user journeys, features, and operating rules.
- [Solution concept](product/solution-concept.md) — a comprehensive overview of how market research and the technical stack align to solve real-world trade bottlenecks.
- [Product Description PDF](product/kuapa-dwaso-product-description.pdf) — a printable, styled PDF document summarizing the product capabilities and system architecture.
- [Technical overview](technical/architecture.md) — the current system architecture, application boundaries, data ownership, integrations, and security posture.
- [Root README](../README.md) — project summary and local quick start.

## Planned maize pilot

- [Implementation backlog](product/maize-pilot-software-tickets.md) - the ordered, unimplemented ticket plan and verification gates.
- [Frozen implementation contracts](technical/maize-pilot-contracts.md) - planned persistence, API, access, event, finance, and compatibility names for downstream tickets.
- [ADR-0005](decisions/ADR-0005-demand-led-maize-pilot-boundary.md) - the accepted boundary between demand-led pilot work and existing warehouse workflows.

These documents authorize implementation work. They do not claim a live pilot,
signed commercial partnership, owned warehouse, real payment, or completed
trade.

## Build and operate

- [Environment and Infisical mapping](deployment/env-and-infisical.md)
- [Kubernetes, Cloudflare Tunnel, and Infisical runbook](deployment/kubernetes-cloudflare-infisical.md)
- [GitHub Actions and secrets](deployment/github-actions-and-secrets.md)
- [Architecture notes](architecture/README.md)

## Engineering conventions and decisions

- [Repository structure](conventions/repo-structure.md)
- [Backend structure](conventions/backend-structure.md)
- [Authentication, onboarding, invitations, and uploads](conventions/auth-onboarding-invites-uploads.md)
- [Admin RBAC](conventions/admin-rbac.md)
- [Market services, delivery runs, notifications, and finance](conventions/market-services-runs-notifications-finance.md)
- [Network performance](conventions/network-performance.md)
- [Architecture decisions](decisions/)

## Historical material

The contents of `intent-and-initial-plans/`, `plans/`, and `ui-plans/` are retained as project history. Some documents describe the earlier marketplace and two-way-SMS direction; they are not the source of truth for the current warehouse product. The older operating model is also historical wherever it conflicts with the maize pilot backlog, ADR-0005, or the frozen pilot contracts. Use the product guide, technical overview, architecture notes, and accepted ADRs for current direction.

## Documentation principles

- Describe what is implemented or explicitly label an item as planned.
- Keep farmer information, credentials, internal URLs, and production screenshots out of the repository.
- Update product documentation when a user-visible workflow changes; update the technical overview and an ADR when an architectural boundary changes.
