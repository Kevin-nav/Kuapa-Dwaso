#!/usr/bin/env bash
set -euo pipefail
# Run as an administrator from an uploaded deploy/compose directory.
# The account can submit image tags and credentials, not arbitrary Compose files.
source_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
if ! id kuapa-deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash kuapa-deploy
fi
install -d -o root -g root -m 755 /opt/kuapa-dwaso
install -d -o root -g root -m 700 /opt/kuapa-dwaso/releases
install -d -o kuapa-deploy -g kuapa-deploy -m 700 /opt/kuapa-dwaso/incoming
install -o root -g root -m 644 "$source_dir/compose.yaml" /opt/kuapa-dwaso/compose.yaml
install -o root -g root -m 755 "$source_dir/deploy.py" /usr/local/sbin/kuapa-deploy
install -o root -g root -m 644 "$source_dir/kuapa-notifications.service" /etc/systemd/system/kuapa-notifications.service
install -o root -g root -m 644 "$source_dir/kuapa-notifications.timer" /etc/systemd/system/kuapa-notifications.timer
printf 'kuapa-deploy ALL=(root) NOPASSWD: /usr/local/sbin/kuapa-deploy *\n' > /etc/sudoers.d/kuapa-deploy
chmod 440 /etc/sudoers.d/kuapa-deploy
visudo -cf /etc/sudoers.d/kuapa-deploy
systemctl daemon-reload
# Enable the notification timer after a release is healthy, not during bootstrap.
docker compose version
