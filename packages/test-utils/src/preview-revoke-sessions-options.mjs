import { previewActorDefinitions } from "./preview-setup-options.mjs";

export const PREVIEW_REVOKE_CONFIRMATION = "REVOKE_PREVIEW_SESSIONS";

const argumentNames = new Map([
  ["farmer-uid", "farmer"],
  ["buyer-uid", "buyer"],
  ["transporter-uid", "transporter"],
  ["operations-uid", "operations"],
  ["confirm", "confirm"],
]);

export function parsePreviewRevokeSessionsOptions(argv, env = process.env) {
  const parsed = {};
  let execute = false;
  for (const argument of argv) {
    if (argument === "--") {
      continue;
    }
    if (argument === "--execute") {
      execute = true;
      continue;
    }
    if (!argument.startsWith("--") || !argument.includes("=")) {
      throw new Error(`Unknown session-revocation argument: ${argument}`);
    }
    const equalsAt = argument.indexOf("=");
    const name = argument.slice(2, equalsAt);
    const key = argumentNames.get(name);
    if (key === undefined) {
      throw new Error(`Unknown session-revocation argument: --${name}`);
    }
    if (parsed[key] !== undefined) {
      throw new Error(
        `Session-revocation argument --${name} was provided twice.`,
      );
    }
    parsed[key] = argument.slice(equalsAt + 1);
  }

  const actorUids = Object.fromEntries(
    previewActorDefinitions.map((definition) => {
      const uid = (
        parsed[definition.key] ?? env[definition.uidEnvironmentName]
      )?.trim();
      if (
        uid === undefined ||
        uid.length === 0 ||
        uid.length > 128 ||
        /\s/.test(uid)
      ) {
        throw new Error(
          `Session revocation requires --${definition.key}-uid=<value> or ${definition.uidEnvironmentName}.`,
        );
      }
      return [definition.key, uid];
    }),
  );
  if (
    new Set(Object.values(actorUids)).size !== previewActorDefinitions.length
  ) {
    throw new Error(
      "Session revocation requires four distinct preview Firebase UIDs.",
    );
  }

  const confirm = parsed.confirm;
  if (execute && confirm !== PREVIEW_REVOKE_CONFIRMATION) {
    throw new Error(
      `Execution requires --confirm=${PREVIEW_REVOKE_CONFIRMATION}.`,
    );
  }
  if (!execute && confirm !== undefined) {
    throw new Error(
      "Do not pass --confirm while previewing session revocation.",
    );
  }
  if (execute && env.PREVIEW_ACCESS_ENABLED !== "false") {
    throw new Error(
      "Set PREVIEW_ACCESS_ENABLED=false in the command environment before revoking sessions.",
    );
  }

  return {
    mode: execute ? "execute" : "dry-run",
    execute,
    actorUids,
  };
}
