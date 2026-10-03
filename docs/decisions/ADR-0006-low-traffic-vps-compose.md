# ADR-0006: Low-traffic VPS deployment with Docker Compose

## Status

Accepted by the project owner on 2026-10-03.

## Decision

Deploy the public staging/demo environment using Docker Compose on the shared
VPS. Keep `NODE_ENV=production`, the existing public domains, staging Infisical,
and the existing external Convex, Firebase, R2, email, and SMS services. Preserve
demo access and data. This supersedes ADR-0003's Kubernetes requirement for this
environment only; the unused production lane remains unchanged.

Deployment files remain in `deploy/`; app and shared-package boundaries do not
change. Build images on GitHub-hosted runners. Run one container per surface
and one Cloudflare Tunnel connector. Do not publish container ports. Compose
project `kuapa-dwaso` owns a dedicated bridge network; compatibility DNS aliases
allow existing staging Kubernetes tunnel routes to resolve inside that network.

Use a root-owned, fixed deployment helper and Compose specification. The
dedicated `kuapa-deploy` account can submit only validated immutable image tags
and Infisical credentials. It is not in the Docker group. Do not grant it sudo
access to arbitrary Docker commands, scripts, or Compose specifications.

Fetch secrets from Infisical during deployment, with root-only release files;
frontends receive public values only. The tunnel receives only its token.
Release snapshots retain previous secrets and image tags for rollback.

## Rationale

Traffic can be less than one visitor per day. A Kubernetes control plane,
continuous secrets operator, duplicate replicas, and local builds create
unnecessary work on a host that will also serve other projects.

## Consequences

The five application containers are capped at 384 MiB each and the connector
at 128 MiB: 2 GiB aggregate RAM limits. CPU caps total 1.6 cores. These limits
are ceilings, not reservations. Each container has a small additional swap
allowance. Idle usage must be measured rather than inferred from traffic.
Next.js processes stay available, avoiding cold-start infrastructure.

The owner requested a persistent 10 GiB swap file and `vm.swappiness=50`.
Swappiness is not a RAM-utilization percentage. Swap is a safety net and must
not replace resource limits. Service memory pressure and swap I/O require
review if other projects are added.

Notification processing uses a systemd timer every five minutes and a short
Node invocation inside the API container, without a permanent worker. No
demo cleanup is scheduled. Release failures restore the previous deployment
when one exists. There is no old VPS to fall back to during initial recovery.

Compose isolation is operational and network separation on a shared kernel;
it is not a separate machine or a security boundary against host administrators.
