#!/usr/bin/python3
"""Root-owned entry point; deploy account can select a SHA tag, never a Compose file."""
import datetime
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path("/opt/kuapa-dwaso")
PROJECT = "1b3b07fb-3a1e-472b-be1c-8a21557f77b9"
INFISICAL = "https://app.infisical.com/api"


def request(path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(INFISICAL + path, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def write_env(path, values):
    lines = []
    for key, value in sorted(values.items()):
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
            raise ValueError("Invalid environment key")
        if "\n" in value or "\r" in value or "\0" in value:
            raise ValueError("Multiline environment values require base64 packaging: " + key)
        lines.append(key + "=" + value)
    path.write_text("\n".join(lines) + "\n")
    path.chmod(0o600)


def compose(release, *args, check=True):
    return subprocess.run([
        "docker", "compose", "--project-name", "kuapa-dwaso",
        "--env-file", str(release / "deploy.env"),
        "--file", str(release / "compose.yaml"), *args,
    ], check=check)


def activate(release):
    temporary = ROOT / "current.next"
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(release)
    temporary.replace(ROOT / "current")


def notify():
    release = (ROOT / "current").resolve(strict=True)
    # The existing API process supplies credentials; nothing secret appears in argv.
    script = "fetch('http://127.0.0.1:4000/sms/webhooks/deliveries/process',{method:'POST',headers:{'x-notification-delivery-secret':process.env.NOTIFICATION_DELIVERY_SECRET}}).then(r=>{console.log('Notification delivery HTTP '+r.status);process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
    compose(release, "exec", "-T", "api", "node", "-e", script)


def deploy(filename):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}\.json", filename):
        raise ValueError("Expected an incoming deployment filename")
    path = ROOT / "incoming" / filename
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        with os.fdopen(descriptor) as stream:
            payload = json.load(stream)
    finally:
        path.unlink(missing_ok=True)
    tag = payload["image_tag"]
    if not re.fullmatch(r"sha-[a-f0-9]{12}", tag):
        raise ValueError("Expected an immutable sha-<12 hex> image tag")
    login = request("/v1/auth/universal-auth/login", {
        "clientId": payload["client_id"], "clientSecret": payload["client_secret"],
    })
    query = urllib.parse.urlencode({"workspaceId": PROJECT, "environment": "staging", "secretPath": "/"})
    exported = request("/v3/secrets/raw?" + query, token=login["accessToken"])
    values = {item["secretKey"]: item["secretValue"] for item in exported["secrets"]}
    for key in ("CONVEX_URL", "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64", "CLOUDFLARE_TUNNEL_TOKEN", "NOTIFICATION_DELIVERY_SECRET", "NEXT_PUBLIC_API_URL"):
        if not values.get(key):
            raise ValueError("Missing required staging setting: " + key)
    values["NODE_ENV"] = "production"
    if values.get("PREVIEW_ACCESS_ENABLED") == "true":
        cutoff = datetime.datetime.fromisoformat(values["PREVIEW_ACCESS_CUTOFF_UTC"].replace("Z", "+00:00"))
        if cutoff <= datetime.datetime.now(datetime.timezone.utc):
            print("Warning: demo access cutoff is expired; update staging Infisical and redeploy.", flush=True)
    identifier = tag + "-" + datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    release = ROOT / "releases" / identifier
    release.mkdir(mode=0o700, parents=True)
    shutil.copyfile(ROOT / "compose.yaml", release / "compose.yaml")
    write_env(release / "deploy.env", {"IMAGE_TAG": tag, "KUAPA_RELEASE_DIR": str(release)})
    write_env(release / "frontend.env", {
        **{key: value for key, value in values.items() if key.startswith("NEXT_PUBLIC_")},
        "NODE_ENV": "production", "NEXT_TELEMETRY_DISABLED": "1",
    })
    write_env(release / "api.env", {
        key: value for key, value in values.items()
        if key != "CLOUDFLARE_TUNNEL_TOKEN" and not key.startswith("INFISICAL_")
    })
    write_env(release / "tunnel.env", {"TUNNEL_TOKEN": values["CLOUDFLARE_TUNNEL_TOKEN"]})
    previous = (ROOT / "current").resolve() if (ROOT / "current").exists() else None
    compose(release, "config", "--quiet")
    compose(release, "pull")
    try:
        compose(release, "up", "--detach", "--wait", "--wait-timeout", "240")
        # cloudflared has no curl/node binary, so probe it from the healthy API.
        script = "fetch('http://cloudflared:2000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
        compose(release, "exec", "-T", "api", "node", "-e", script)
    except subprocess.CalledProcessError:
        if previous:
            print("Deployment failed; restoring previous release.", flush=True)
            compose(previous, "up", "--detach", "--wait", "--wait-timeout", "240")
        raise
    if previous:
        backup = ROOT / "previous"
        backup.unlink(missing_ok=True)
        backup.symlink_to(previous)
    activate(release)
    compose(release, "ps")
    print("Activated " + identifier)


def main():
    os.umask(0o077)
    if os.geteuid() != 0 or len(sys.argv) != 2:
        raise ValueError("Run the installed entry point through sudo with one argument")
    with (ROOT / "deploy.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if sys.argv[1] == "--notify":
            notify()
        elif sys.argv[1] == "--rollback":
            release = (ROOT / "previous").resolve(strict=True)
            compose(release, "up", "--detach", "--wait", "--wait-timeout", "240")
            activate(release)
        else:
            deploy(sys.argv[1])


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        print("Infisical request failed: HTTP " + str(error.code), file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        # Do not print response bodies, credentials, or secret values.
        print("Deployment failed: " + type(error).__name__, file=sys.stderr)
        sys.exit(1)
