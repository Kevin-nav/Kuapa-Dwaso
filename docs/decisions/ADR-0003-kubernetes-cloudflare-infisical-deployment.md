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
and production Infisical environments into native Kubernetes Secrets. Machine
identity material and Cloudflare tunnel credentials are bootstrap-created
Kubernetes Secrets and are not committed to git.

## Rationale

Kustomize keeps the first deployment foundation inspectable and manually
apply-able without introducing a chart abstraction before the operational
contract is stable. Separate overlays encode the branch/environment split:
`main` deploys staging values and the protected `production` branch deploys
production values.

Cloudflare Tunnel fits the VPS/K3s target because the cluster can serve public
traffic without opening application ports to the Internet. Infisical keeps
runtime secrets out of git while still giving Kubernetes a native Secret to
mount into each deployment.

## Consequences

Deployment automation is intentionally left to the GitHub Actions lane. The
manifests can be applied manually with `kubectl apply -k` once images,
Cloudflare tunnel credentials, Infisical machine identity resources, and
environment values are in place.

Next.js `NEXT_PUBLIC_*` values must be present at image build time because they
are compiled into browser bundles. The same values are also synced at runtime
for scripts and server-side reads.
