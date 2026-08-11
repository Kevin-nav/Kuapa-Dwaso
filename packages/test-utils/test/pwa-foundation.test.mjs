import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = resolve(import.meta.dirname, "../../..");
const surfaces = ["app", "ops", "admin"];

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function exerciseWorker(source, protectedPath) {
  const handlers = {};
  const cacheWrites = [];
  const cache = {
    addAll: async () => undefined,
    delete: async () => true,
    keys: async () => [],
    match: async () => undefined,
    put: async (request) => { cacheWrites.push(request.url); },
  };
  const context = vm.createContext({
    URL,
    Response,
    caches: { keys: async () => [], open: async () => cache, match: async () => new Response("offline") },
    fetch: async () => new Response("network"),
    setTimeout,
    self: {
      location: { origin: "https://surface.example" },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      clients: { claim: async () => undefined },
    },
  });
  vm.runInContext(`${source}\nglobalThis.__navigation = navigation;`, context);
  await context.__navigation({ method: "GET", mode: "navigate", url: `https://surface.example${protectedPath}` });
  assert.deepEqual(cacheWrites, [], `${protectedPath} must not enter a shared navigation cache`);
  let intercepted = false;
  handlers.fetch({ request: { method: "GET", mode: "cors", url: "https://surface.example/api/private" }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false, "API traffic must bypass the service worker cache");
}

for (const surface of surfaces) {
  test(`${surface} has a scoped installable manifest`, async () => {
    const source = await readFile(resolve(repoRoot, `apps/${surface}/app/manifest.ts`), "utf8");
    assert.match(source, /id: "\/"/);
    assert.match(source, /scope: "\/"/);
    assert.match(source, /display: "standalone"/);
    assert.match(source, /icon-maskable-512\.png/);
  });

  test(`${surface} PWA icons have declared dimensions`, async () => {
    for (const size of [192, 512]) {
      for (const prefix of ["icon", "icon-maskable"]) {
        const image = await readFile(resolve(repoRoot, `apps/${surface}/public/pwa/${prefix}-${size}.png`));
        assert.deepEqual(pngDimensions(image), { width: size, height: size });
      }
    }
    const apple = await readFile(resolve(repoRoot, `apps/${surface}/public/pwa/apple-touch-icon.png`));
    assert.deepEqual(pngDimensions(apple), { width: 180, height: 180 });
  });

  test(`${surface} service worker excludes sensitive traffic`, async () => {
    const source = await readFile(resolve(repoRoot, `apps/${surface}/public/sw.js`), "utf8");
    await exerciseWorker(source, surface === "app" ? "/farmer" : "/");
  });
}

test("the public site stays non-installable", async () => {
  await assert.rejects(readFile(resolve(repoRoot, "apps/www/app/manifest.ts"), "utf8"));
});

test("image builds default the ops development actor fallback to false", async () => {
  const workflow = await readFile(resolve(repoRoot, ".github/workflows/build-publish-images.yml"), "utf8");
  assert.match(workflow, /actor_fallback="\$\{NEXT_PUBLIC_ENABLE_DEV_ACTOR_FALLBACK:-false\}"/);
  assert.match(workflow, /NEXT_PUBLIC_ENABLE_DEV_ACTOR_FALLBACK=%s/);
});
