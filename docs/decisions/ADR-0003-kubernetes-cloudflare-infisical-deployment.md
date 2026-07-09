# ADR-0003: Kubernetes, Cloudflare Tunnel, and Infisical Deployment Foundation

## Status

Accepted

## Decision

Add `deploy/` as the repository location for deployment-only assets. The app
and package boundaries remain unchanged: product code stays under `apps/`,
shared code stays under `packages/`, Convex code stays under `convex/`, and
architecture documentation stays under `docs/`.

Use Kustomize overlays for Kubernetes manifests in this phase:

```text
deploy/k8s/base/
deploy/k8s/overlays/staging/
deploy/k8s/overlays/production/
```

Use Cloudflare Tunnel as the only public ingress path for the VPS Kubernetes
cluster. Services remain `ClusterIP` and are not exposed through public
NodePort or LoadBalancer resources.

Use the Infisical Kubernetes Operator `v1beta1` resources to sync the staging
and production Infisical environments into native Kubernetes Secrets. Universal
Auth client credentials are bootstrap-created as a Kubernetes Secret and are
not committed to git. Cloudflare Tunnel tokens are stored per environment in
Infisical and synced into Kubernetes with the rest of the runtime Secret.

## Rationale

Kustomize keeps the first deployment foundation inspectable and manually
apply-able without introducing a chart abstraction before the operational
contract is stable. Separate overlays encode the branch/environment split:
`main` deploys staging values and the protected `production` branch deploys
production values.

Cloudflare Tunnel fits the VPS/K3s target because the cluster can serve public
traffic without opening application ports to the Internet. Dashboard-managed
tunnel token mode avoids storing Cloudflare tunnel credential JSON on the VPS
or as manually created Kubernetes bootstrap Secrets. Infisical keeps runtime
and deployment secrets out of git while still giving Kubernetes a native Secret
to mount into each deployment.

## Consequences

Deployment automation is intentionally left to the GitHub Actions lane. The
manifests can be applied manually with `kubectl apply -k` once images,
Infisical Universal Auth bootstrap Secrets, dashboard-managed Cloudflare Tunnel
tokens, and environment values are in place.

Next.js `NEXT_PUBLIC_*` values must be present at image build time because they
are compiled into browser bundles. The same values are also synced at runtime
for scripts and server-side reads.
