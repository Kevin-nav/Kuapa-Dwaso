# Kubernetes, Cloudflare Tunnel, and Infisical Deployment Runbook

This foundation deploys `www`, `app`, `admin`, `ops`, and `api` to a VPS
Kubernetes cluster, including K3s-compatible clusters. Public traffic enters
only through Cloudflare Tunnel. Kubernetes services are `ClusterIP` and should
not be changed to public `NodePort` or `LoadBalancer` services.

## Layout

```text
deploy/
  docker/Dockerfile
  k8s/base/
  k8s/overlays/staging/
  k8s/overlays/production/
```

The base contains the shared Deployments, Services, `cloudflared` deployment,
Infisical Operator resources, and the notification delivery CronJob. Overlays
set namespaces, Infisical environment slugs, and image tags. Cloudflare Tunnel
public hostnames and service routes are managed in the Cloudflare dashboard.

## Images

Build each surface from the repository root with the shared Dockerfile:

```text
docker build -f deploy/docker/Dockerfile --build-arg APP_SCOPE=@kuapa-dwaso/www --build-arg APP_DIR=www -t ghcr.io/kuapa-dwaso/www:<tag> .
docker build -f deploy/docker/Dockerfile --build-arg APP_SCOPE=@kuapa-dwaso/app --build-arg APP_DIR=app -t ghcr.io/kuapa-dwaso/app:<tag> .
docker build -f deploy/docker/Dockerfile --build-arg APP_SCOPE=@kuapa-dwaso/admin --build-arg APP_DIR=admin -t ghcr.io/kuapa-dwaso/admin:<tag> .
docker build -f deploy/docker/Dockerfile --build-arg APP_SCOPE=@kuapa-dwaso/ops --build-arg APP_DIR=ops -t ghcr.io/kuapa-dwaso/ops:<tag> .
docker build -f deploy/docker/Dockerfile --build-arg APP_SCOPE=@kuapa-dwaso/api --build-arg APP_DIR=api -t ghcr.io/kuapa-dwaso/api:<tag> .
```

For Next.js apps, pass the environment's public build values as build args:
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`,
`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
`NEXT_PUBLIC_ENABLE_DEV_ACTOR_FALLBACK`, and
`NEXT_PUBLIC_OPS_ACTOR_USER_ID`. These values are public browser config but
must still match the target environment.

GitHub Actions owns automation and the final image tag contract. The manifests
default to `staging` and `production` tags as placeholders.

## Cluster Bootstrap

Install the Infisical Kubernetes Operator before applying these overlays. The
manifests use the recommended `v1beta1` `InfisicalConnection`,
`InfisicalAuth`, and `InfisicalStaticSecret` resources. Infisical documents the
operator as syncing secrets into Kubernetes and keeping managed Secrets updated.

Create this bootstrap Secret in each namespace before applying workloads:

```text
kubectl create namespace kuapa-dwaso-staging
kubectl -n kuapa-dwaso-staging create secret generic infisical-machine-identity --from-literal=identityId=<staging-machine-identity-id>

kubectl create namespace kuapa-dwaso-production
kubectl -n kuapa-dwaso-production create secret generic infisical-machine-identity --from-literal=identityId=<production-machine-identity-id>
```

The committed manifests do not contain machine identity IDs, Cloudflare Tunnel
tokens, provider keys, Firebase Admin JSON, R2 credentials, or webhook secrets.

## Infisical Setup

Create one Infisical project or project slug for Kuapa Dwaso and add separate
`staging` and `prod` environments. Copy `.env.example.staging` into the staging
environment and `.env.example.prod` into production. Store
`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` as base64-encoded JSON and
`CLOUDFLARE_TUNNEL_TOKEN` as the Cloudflare dashboard tunnel token for that
environment, as described in `docs/deployment/env-and-infisical.md`.

Patch `<infisical-project-slug>` in:

```text
deploy/k8s/overlays/staging/kustomization.yaml
deploy/k8s/overlays/production/kustomization.yaml
```

Staging should use its own Convex URL. Production must use the production
Convex deployment. Firebase may be the same project across all domains, but
Firebase allowed domains must include every deployed origin.

## Cloudflare Tunnel Setup

Create separate Cloudflare dashboard-managed tunnels for staging and
production. Do not create Kubernetes `credentials.json` Secrets and do not copy
tunnel credentials onto the VPS. Copy each tunnel's dashboard token into the
matching Infisical environment as `CLOUDFLARE_TUNNEL_TOKEN`.

The Infisical Operator syncs `CLOUDFLARE_TUNNEL_TOKEN` into the
`cloudflare-tunnel-token` Kubernetes Secret. The `cloudflared` Deployment reads
it as `TUNNEL_TOKEN` and starts with:

```text
cloudflared tunnel --no-autoupdate --metrics 0.0.0.0:2000 run --token <token>
```

Configure public hostnames and service routes in the Cloudflare dashboard.

Expected hostname shape:

```text
staging.<domain>          -> www
app.staging.<domain>      -> app
admin.staging.<domain>    -> admin
ops.staging.<domain>      -> ops
api.staging.<domain>      -> api

<domain>                  -> www
app.<domain>              -> app
admin.<domain>            -> admin
ops.<domain>              -> ops
api.<domain>              -> api
```

Use these service URLs for staging:

```text
http://www.kuapa-dwaso-staging.svc.cluster.local:3000
http://app.kuapa-dwaso-staging.svc.cluster.local:3000
http://admin.kuapa-dwaso-staging.svc.cluster.local:3000
http://ops.kuapa-dwaso-staging.svc.cluster.local:3000
http://api.kuapa-dwaso-staging.svc.cluster.local:4000
```

Use these service URLs for production:

```text
http://www.kuapa-dwaso-production.svc.cluster.local:3000
http://app.kuapa-dwaso-production.svc.cluster.local:3000
http://admin.kuapa-dwaso-production.svc.cluster.local:3000
http://ops.kuapa-dwaso-production.svc.cluster.local:3000
http://api.kuapa-dwaso-production.svc.cluster.local:4000
```

To rotate a tunnel token, update `CLOUDFLARE_TUNNEL_TOKEN` in the matching
Infisical environment, wait for the operator to refresh the Kubernetes Secret,
then restart or roll the `cloudflared` Deployment if the pods do not restart
through your normal deployment path.

## Apply And Verify

Render first:

```text
kubectl kustomize deploy/k8s/overlays/staging
kubectl kustomize deploy/k8s/overlays/production
```

Apply manually when the bootstrap Secrets and images exist:

```text
kubectl apply -k deploy/k8s/overlays/staging
kubectl apply -k deploy/k8s/overlays/production
```

Check rollout:

```text
kubectl -n kuapa-dwaso-staging rollout status deploy/www
kubectl -n kuapa-dwaso-staging rollout status deploy/app
kubectl -n kuapa-dwaso-staging rollout status deploy/admin
kubectl -n kuapa-dwaso-staging rollout status deploy/ops
kubectl -n kuapa-dwaso-staging rollout status deploy/api
kubectl -n kuapa-dwaso-staging get infisicalstaticsecret kuapa-dwaso-runtime
kubectl -n kuapa-dwaso-staging logs deploy/cloudflared
```

Use the production namespace for production checks.

## Notification Delivery

`notification-delivery` runs every five minutes and calls:

```text
POST http://api:4000/sms/webhooks/deliveries/process
```

It reads `NOTIFICATION_DELIVERY_SECRET` from the Infisical-managed runtime
Secret and sends it as `x-notification-delivery-secret`.

## Rollback

Prefer image-tag rollback first:

```text
kubectl -n kuapa-dwaso-staging set image deploy/app app=ghcr.io/kuapa-dwaso/app:<previous-tag>
kubectl -n kuapa-dwaso-staging rollout status deploy/app
```

For manifest rollbacks, revert the manifest commit or apply a previous
Kustomize render. Avoid editing live resources by hand except during incident
response, and back-port any emergency change into the manifests afterward.

## Production Hardening Notes

Protect the `production` branch before enabling production automation. Rotate
Infisical machine identities, provider keys, Cloudflare Tunnel tokens, and
Firebase Admin service accounts on a schedule and after personnel changes. Keep
R2 buckets private-only; this platform uses signed PUT and signed GET URLs, not
a public bucket URL. No public R2 bucket is involved in Cloudflare Tunnel
routing.

Configure provider webhooks to the deployed API origin:

```text
POST /sms/webhooks/arkesel/delivery
POST /payments/webhooks/paystack
```

Confirm Firebase allowed domains, privileged MFA, reCAPTCHA behavior, R2 CORS
for deployed browser origins, Arkesel sender ID approval, and Paystack account
status before production cutover.
