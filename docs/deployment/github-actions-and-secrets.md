# GitHub Actions and Secrets Contract

This repo uses GitHub-hosted runners only.

- Pull requests and pushes run CI without production secrets.
- Pushes to `main` build images and then deploy `staging`.
- Pushes to `production` build images and then deploy `production`.
- Manual dispatch can rebuild or redeploy either environment.

Runtime application secrets stay in Infisical. GitHub stores only deployment
bootstrap credentials, build-time public client values, and environment routing
metadata.

Reference docs:

- GitHub Environments and required reviewers:
  https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment
- GitHub deployment environment behavior:
  https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- Publishing Docker images with GitHub Actions:
  https://docs.github.com/actions/guides/publishing-docker-images
- GHCR and `GITHUB_TOKEN` permissions:
  https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- Infisical CLI export with universal auth:
  https://infisical.com/docs/cli/commands/export

## Workflows

`.github/workflows/ci.yml`

Runs on pull requests and pushes to `main` or `production`:

- `corepack pnpm install --frozen-lockfile`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm --filter @kuapa-dwaso/api test`
- `corepack pnpm provider:doctor -- --mode=dev`

The provider doctor runs in dev mode so missing real provider credentials are
warnings, not PR blockers.

`.github/workflows/build-publish-images.yml`

Builds and publishes five deployable images:

- `www`
- `app`
- `admin`
- `ops`
- `api`

The default registry is GHCR. Images are pushed as:

```text
ghcr.io/<owner>/<repo>/www:sha-<12-char-sha>
ghcr.io/<owner>/<repo>/www:<branch-name>
ghcr.io/<owner>/<repo>/app:sha-<12-char-sha>
...
```

The workflow uses `GITHUB_TOKEN` with `packages: write` for GHCR publishing.
If a different registry is selected, add explicit registry login steps before
enabling it.

`.github/workflows/deploy.yml`

Deploys after the image workflow succeeds. The default deploy path is SSH from a
GitHub-hosted runner to a restricted VPS deploy user with `kubectl` and
`kustomize` access to the local Kubernetes cluster.

This avoids exposing the VPS Kubernetes API publicly. If a future team chooses
to use a kubeconfig directly in GitHub Actions, the Kubernetes API must be
reachable from GitHub-hosted runners, strongly authenticated, IP/rate protected
where practical, and the kubeconfig must be stored as an environment secret.

The deployment script expects the VPS to have a repo checkout at
`VPS_DEPLOY_WORKDIR`, defaulting to `~/kuapa-dwaso`. It fetches the target
commit, copies the selected Kustomize overlay to a temp directory, rewrites the
five image tags, and applies the overlay.

Until the Kubernetes lane lands manifests, `ALLOW_MISSING_KUSTOMIZE_OVERLAY`
defaults to `true`. With that default, deploy jobs skip successfully when
`deploy/k8s/overlays/<environment>` is absent. Set it to `false` after manifests
exist.

## Expected Kubernetes Manifest Contract

The parallel deployment lane should provide overlays at:

```text
deploy/k8s/overlays/staging
deploy/k8s/overlays/production
```

The default Kustomize image placeholders are:

```text
kuapa-dwaso/www
kuapa-dwaso/app
kuapa-dwaso/admin
kuapa-dwaso/ops
kuapa-dwaso/api
```

Override them with `K8S_IMAGE_NAME_WWW`, `K8S_IMAGE_NAME_APP`,
`K8S_IMAGE_NAME_ADMIN`, `K8S_IMAGE_NAME_OPS`, and `K8S_IMAGE_NAME_API` if the
manifests use different names.

Kubernetes workloads should read runtime app secrets from an Infisical-backed
Kubernetes Secret, default name:

```text
kuapa-dwaso-runtime-env
```

The workflow can create/update that Secret with the Infisical CLI on the VPS
when the deploy user has `infisical` installed and the Infisical variables below
are configured. Otherwise, another controller or manual sync process must keep
the runtime Secret current.

## GitHub Environments

Create two GitHub Environments:

```text
staging
production
```

Recommended protection:

- `staging`: restrict deployment branches to `main`; no required reviewer unless
  the team wants a manual staging gate.
- `production`: restrict deployment branches to `production`; require at least
  one reviewer before jobs can access environment secrets.

Environment secrets are unavailable until the job enters the environment. For
production, required reviewers protect both deployment execution and production
environment secrets.

## Required GitHub Environment Secrets

Configure these in both `staging` and `production` environments:

```text
VPS_DEPLOY_HOST
VPS_DEPLOY_USER
VPS_DEPLOY_SSH_KEY
INFISICAL_CLIENT_ID
INFISICAL_CLIENT_SECRET
```

Optional environment secrets:

```text
VPS_DEPLOY_PORT
VPS_DEPLOY_KNOWN_HOSTS
```

`VPS_DEPLOY_PORT` defaults to `22`. `VPS_DEPLOY_KNOWN_HOSTS` is strongly
recommended. If omitted, the workflow uses `ssh-keyscan`, which is convenient
for first setup but weaker because it trusts the key observed at deploy time.

The SSH key should belong to a restricted VPS user that can run `kubectl` only
for this deployment path. Do not use a personal admin SSH key.

Do not store app runtime secrets in GitHub. These belong in Infisical:

- Firebase Admin service account
- Resend API key
- Arkesel API key and webhook signing material
- Paystack secret key and webhook secret
- Cloudflare R2 access key and secret
- Notification delivery secret
- Convex server/runtime secrets

## Required GitHub Environment Variables

Configure these in both `staging` and `production` environments:

```text
NEXT_PUBLIC_CONVEX_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
INFISICAL_PROJECT_ID
```

These `NEXT_PUBLIC_*` values are public browser build-time values. They are not
runtime secrets, but they must point at the correct staging or production
providers.

Optional environment variables:

```text
IMAGE_REGISTRY
IMAGE_REPOSITORY_PREFIX
KUBE_NAMESPACE
KUSTOMIZE_OVERLAY_PATH
VPS_DEPLOY_WORKDIR
ALLOW_MISSING_KUSTOMIZE_OVERLAY
INFISICAL_ENVIRONMENT_SLUG
INFISICAL_SECRET_PATH
INFISICAL_SYNC_REQUIRED
K8S_RUNTIME_SECRET_NAME
K8S_IMAGE_NAME_WWW
K8S_IMAGE_NAME_APP
K8S_IMAGE_NAME_ADMIN
K8S_IMAGE_NAME_OPS
K8S_IMAGE_NAME_API
```

Defaults:

```text
IMAGE_REGISTRY=ghcr.io
IMAGE_REPOSITORY_PREFIX=ghcr.io/<owner>/<repo>
KUBE_NAMESPACE=kuapa-dwaso-<environment>
KUSTOMIZE_OVERLAY_PATH=deploy/k8s/overlays/<environment>
VPS_DEPLOY_WORKDIR=~/kuapa-dwaso
ALLOW_MISSING_KUSTOMIZE_OVERLAY=true
INFISICAL_ENVIRONMENT_SLUG=<environment>
INFISICAL_SECRET_PATH=/
INFISICAL_SYNC_REQUIRED=false
K8S_RUNTIME_SECRET_NAME=kuapa-dwaso-runtime-env
K8S_IMAGE_NAME_WWW=kuapa-dwaso/www
K8S_IMAGE_NAME_APP=kuapa-dwaso/app
K8S_IMAGE_NAME_ADMIN=kuapa-dwaso/admin
K8S_IMAGE_NAME_OPS=kuapa-dwaso/ops
K8S_IMAGE_NAME_API=kuapa-dwaso/api
```

After Kubernetes manifests exist, set:

```text
ALLOW_MISSING_KUSTOMIZE_OVERLAY=false
```

If the workflow must fail whenever Infisical sync is not performed by the deploy
script, set:

```text
INFISICAL_SYNC_REQUIRED=true
```

## VPS Setup

The restricted deploy user needs:

- `git`
- `kubectl`
- `kustomize`
- optional `infisical`
- read access to the repo checkout at `VPS_DEPLOY_WORKDIR`
- Kubernetes RBAC to update the target namespace only

The VPS or Kubernetes cluster must be able to pull the selected images from
GHCR. If the GHCR packages remain private, create a Kubernetes image pull
secret in each namespace. Do not store that pull secret in this repo.

Public traffic enters through Cloudflare Tunnel. The GitHub workflows do not
need Cloudflare API credentials unless a future workflow automates tunnel
creation or DNS changes.

## Branch Protection

Recommended `main` protection:

- Require pull request before merge.
- Require the `CI / Typecheck, lint, and test` status check.
- Require branches to be up to date before merge.
- Block force pushes and branch deletion.

Recommended `production` protection:

- Restrict who can push or merge.
- Require pull request before merge.
- Require the `CI / Typecheck, lint, and test` status check.
- Require successful image build on the source commit before promotion.
- Require signed commits if the organization uses commit signing.
- Block force pushes and branch deletion.

Promotion flow:

1. Merge to `main`.
2. Confirm staging CI, image publish, and deploy.
3. Open a PR from `main` to `production`.
4. Merge after required checks pass.
5. Approve the `production` GitHub Environment deployment.
