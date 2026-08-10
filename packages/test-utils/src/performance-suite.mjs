import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { performanceProfileNames } from "./performance-profiles.mjs";

function values(name) {
  return process.argv.flatMap((argument, index) =>
    argument === `--${name}` && process.argv[index + 1]
      ? [process.argv[index + 1]]
      : [],
  );
}

function option(name, fallback) {
  return values(name)[0] ?? fallback;
}

const targets = values("target").map((target) => {
  const separator = target.indexOf("=");
  if (separator < 1) {
    throw new Error('--target must use the format "label=http://url".');
  }
  return {
    label: target.slice(0, separator),
    url: target.slice(separator + 1),
  };
});
if (targets.length === 0) {
  targets.push({
    label: option("label", "homepage"),
    url: option("url", "http://127.0.0.1:3000"),
  });
}

const profiles = option("profiles", performanceProfileNames.join(",")).split(
  ",",
);
const runs = option("runs", "3");
const benchmarkScript = fileURLToPath(
  new URL("./performance-lighthouse.mjs", import.meta.url),
);

for (const target of targets) {
  for (const profile of profiles) {
    const result = spawnSync(
      process.execPath,
      [
        benchmarkScript,
        "--url",
        target.url,
        "--label",
        `${target.label}-${profile}`,
        "--profile",
        profile,
        "--runs",
        runs,
      ],
      { stdio: "inherit" },
    );
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}
