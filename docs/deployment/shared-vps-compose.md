# Shared VPS Compose deployment

The public demo uses Infisical `staging` with production builds and the existing
`kuapadwaso.com` domains. See ADR-0006. The production Kubernetes lane is retained
but is not activated on this VPS. Convex, Firebase, and R2 remain externally
hosted; do not reseed, migrate, or clean up their data as part of a host move.

## Bootstrap

Install the OS-supported Docker Engine and Compose v2 packages. Upload
`deploy/compose` and run `sudo bash bootstrap.sh` as a host administrator.
Install a dedicated deployment SSH public key for `kuapa-deploy`. The account
must not belong to the Docker group. Keep SSH available through the existing
firewall. Never publish container ports; Cloudflare Tunnel supplies ingress.

The root-owned `/usr/local/sbin/kuapa-deploy` reads only validated JSON filenames
from `/opt/kuapa-dwaso/incoming`, selects fixed GHCR repositories with immutable
SHA tags, fetches only this project's staging environment, and runs only the
installed root-owned Compose specification. Updating the installed helper or
specification requires an administrator; CI cannot upload arbitrary host code.

The host uses a persistent 10 GiB `/swapfile` with mode 600 and
`/etc/sysctl.d/99-kuapa-swap.conf` containing `vm.swappiness=50`. The fstab backup
is `/etc/fstab.before-kuapa-swap`. Validate using `swapon --show`, `sysctl
vm.swappiness`, and `free -h`. This setting is host-wide, not a percentage or a
guarantee that swap will remain unused until a particular RAM threshold.

## GitHub automation

`Build and Publish Images` builds off-host. `Deploy Compose` deploys `main` to
the `staging` GitHub Environment after a successful image build. Manual dispatch
accepts an existing `sha-<12 hex>` image tag. The legacy `Deploy` workflow handles
only the separate production Kubernetes lane.

Staging environment secrets:

- `VPS_DEPLOY_HOST`: new VPS address
- `VPS_DEPLOY_USER`: `kuapa-deploy`
- `VPS_DEPLOY_SSH_KEY`: dedicated private key
- `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`: staging read identity

Staging environment variables:

- `VPS_DEPLOY_PORT`: `22`
- `VPS_DEPLOY_KNOWN_HOSTS`: verified new host key, obtained through the trusted SSH session
- `INFISICAL_PROJECT_ID`: existing Kuapa project; the installed helper pins this project

The job uploads a mode-600 JSON request, calls the limited sudo helper, and
deletes local credentials. The helper deletes the request after reading it.
No Infisical bootstrap credentials are retained on the server. Runtime secrets
are root-only files within a release snapshot; Docker supplies them to the
appropriate containers. Frontends get only `NEXT_PUBLIC_*` and nonsecret
runtime configuration. Cloudflared gets only `TUNNEL_TOKEN`.

## Tunnel routes

Existing routes such as
`http://app.kuapa-dwaso-staging.svc.cluster.local:3000` resolve using network-local
DNS aliases. Simple Compose service routes also work (`http://app:3000`,
`http://api:4000`). Verify the dashboard-managed tunnel's actual configuration
after connection. These aliases do not create Kubernetes or expose its API.

## Verify and monitor

Inspect containers using the release's config, without printing runtime secrets:

```sh
sudo docker compose --project-name kuapa-dwaso --env-file /opt/kuapa-dwaso/current/deploy.env --file /opt/kuapa-dwaso/current/compose.yaml ps
sudo docker stats --no-stream
free -h
vmstat 1 5
```

The deployment waits for all five HTTP health checks and checks tunnel readiness
through the API container. Confirm all public domains, navigation, Firebase
login, all four demo roles, and browser-side API/CORS separately. Do not print
Firebase custom tokens in logs. Existing demo data and access settings are
preserved. An expired `PREVIEW_ACCESS_CUTOFF_UTC` is reported; restoring the host
does not bypass that expiry. A write-capable Infisical account must extend the
cutoff and redeploy before demo sign-in works again. No cleanup is scheduled.

After the initial healthy release, enable `kuapa-notifications.timer` with
`sudo systemctl enable --now kuapa-notifications.timer`. It keeps the previous
five-minute delivery cadence and executes inside the existing API container.

Containers start after reboot through `restart: unless-stopped`; Docker itself
must be enabled. The stack has 2 GiB aggregate RAM caps and 1.6 CPU cores of
aggregate caps, not reservations. Keep checks at a modest interval and review
actual idle usage. PID counts and application/tunnel logs are bounded. Do not
run global `docker system prune` on a host shared with other projects.

## Rollback

Every release retains its fixed Compose specification, image tag, and root-only
environment files. A failed rollout restores the previous release if available.
For a manual rollback run `sudo /usr/local/sbin/kuapa-deploy --rollback` as a host
administrator. The initial deployment has no old host to fall back to.

Retain the current and previous releases and their images. Review older
snapshots periodically; they contain historical secrets and must remain mode
700/600. Do not delete images belonging to other Compose projects.
