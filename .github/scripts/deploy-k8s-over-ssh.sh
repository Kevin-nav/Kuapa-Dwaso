#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-}"
if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" ]]; then
  echo "Deployment env file is required." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cleanup() {
  rm -f "$ENV_FILE" "$0"
}
trap cleanup EXIT

required() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "$name is required." >&2
    exit 1
  fi
}

required DEPLOY_ENVIRONMENT
required GITHUB_REPOSITORY
required GITHUB_SHA
required IMAGE_REGISTRY
required IMAGE_REPOSITORY_PREFIX
required IMAGE_TAG
required KUBE_NAMESPACE
required KUSTOMIZE_OVERLAY_PATH

ALLOW_MISSING_KUSTOMIZE_OVERLAY="${ALLOW_MISSING_KUSTOMIZE_OVERLAY:-true}"
VPS_DEPLOY_WORKDIR="${VPS_DEPLOY_WORKDIR:-$HOME/kuapa-dwaso}"

if [[ ! -d "$VPS_DEPLOY_WORKDIR/.git" ]]; then
  if [[ "$ALLOW_MISSING_KUSTOMIZE_OVERLAY" == "true" ]]; then
    echo "VPS_DEPLOY_WORKDIR $VPS_DEPLOY_WORKDIR is not a git checkout; skipping deployment until manifests are installed."
    exit 0
  fi
  echo "VPS_DEPLOY_WORKDIR $VPS_DEPLOY_WORKDIR must be an existing git checkout." >&2
  exit 1
fi

cd "$VPS_DEPLOY_WORKDIR"
git fetch --quiet origin "$GITHUB_SHA"
git checkout --quiet "$GITHUB_SHA"

if [[ ! -d "$KUSTOMIZE_OVERLAY_PATH" ]]; then
  if [[ "$ALLOW_MISSING_KUSTOMIZE_OVERLAY" == "true" ]]; then
    echo "Kustomize overlay $KUSTOMIZE_OVERLAY_PATH is missing; skipping deployment until deploy/k8s lands."
    exit 0
  fi
  echo "Kustomize overlay $KUSTOMIZE_OVERLAY_PATH is missing." >&2
  exit 1
fi

command -v kubectl >/dev/null 2>&1 || {
  echo "kubectl must be installed for the restricted deploy user." >&2
  exit 1
}
command -v kustomize >/dev/null 2>&1 || {
  echo "kustomize must be installed for image tag substitution." >&2
  exit 1
}

kubectl get namespace "$KUBE_NAMESPACE" >/dev/null

if command -v infisical >/dev/null 2>&1 && [[ -n "${INFISICAL_PROJECT_ID:-}" && -n "${INFISICAL_CLIENT_ID:-}" && -n "${INFISICAL_CLIENT_SECRET:-}" ]]; then
  INFISICAL_ENVIRONMENT_SLUG="${INFISICAL_ENVIRONMENT_SLUG:-$DEPLOY_ENVIRONMENT}"
  INFISICAL_SECRET_PATH="${INFISICAL_SECRET_PATH:-/}"
  K8S_RUNTIME_SECRET_NAME="${K8S_RUNTIME_SECRET_NAME:-kuapa-dwaso-runtime-env}"
  tmp_env="$(mktemp)"
  trap 'rm -f "$tmp_env"; cleanup' EXIT

  INFISICAL_TOKEN="$(infisical login --method=universal-auth --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" --plain --silent)"
  export INFISICAL_TOKEN
  infisical export --projectId="$INFISICAL_PROJECT_ID" --env="$INFISICAL_ENVIRONMENT_SLUG" --path="$INFISICAL_SECRET_PATH" --format=dotenv > "$tmp_env"
  kubectl -n "$KUBE_NAMESPACE" create secret generic "$K8S_RUNTIME_SECRET_NAME" --from-env-file="$tmp_env" --dry-run=client -o yaml | kubectl apply -f -
elif [[ "${INFISICAL_SYNC_REQUIRED:-false}" == "true" ]]; then
  echo "Infisical sync is required, but infisical CLI or machine identity settings are missing." >&2
  exit 1
else
  echo "Infisical sync skipped; deploy expects runtime secrets to already exist in Kubernetes."
fi

tmp_overlay="$(mktemp -d)"
cp -R "$KUSTOMIZE_OVERLAY_PATH/." "$tmp_overlay/"

pushd "$tmp_overlay" >/dev/null
kustomize edit set image "${K8S_IMAGE_NAME_WWW:-kuapa-dwaso/www}=${IMAGE_REPOSITORY_PREFIX}/www:${IMAGE_TAG}"
kustomize edit set image "${K8S_IMAGE_NAME_APP:-kuapa-dwaso/app}=${IMAGE_REPOSITORY_PREFIX}/app:${IMAGE_TAG}"
kustomize edit set image "${K8S_IMAGE_NAME_ADMIN:-kuapa-dwaso/admin}=${IMAGE_REPOSITORY_PREFIX}/admin:${IMAGE_TAG}"
kustomize edit set image "${K8S_IMAGE_NAME_OPS:-kuapa-dwaso/ops}=${IMAGE_REPOSITORY_PREFIX}/ops:${IMAGE_TAG}"
kustomize edit set image "${K8S_IMAGE_NAME_API:-kuapa-dwaso/api}=${IMAGE_REPOSITORY_PREFIX}/api:${IMAGE_TAG}"
popd >/dev/null

kubectl -n "$KUBE_NAMESPACE" apply -k "$tmp_overlay"
rm -rf "$tmp_overlay"
