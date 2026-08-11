const targets = process.argv.slice(2).filter((value) => value.startsWith("http"));
if (targets.length === 0) throw new Error("Pass one or more running app origins, for example http://127.0.0.1:3001.");
for (const origin of targets) {
  const [manifestResponse, workerResponse] = await Promise.all([fetch(`${origin}/manifest.webmanifest`), fetch(`${origin}/sw.js`)]);
  if (!manifestResponse.ok || !workerResponse.ok) throw new Error(`${origin} did not expose its manifest and service worker.`);
  const manifest = await manifestResponse.json();
  if (manifest.id !== "/" || manifest.scope !== "/" || manifest.display !== "standalone") throw new Error(`${origin} returned an invalid manifest.`);
  const cacheControl = workerResponse.headers.get("cache-control") ?? "";
  if (!cacheControl.includes("no-store")) throw new Error(`${origin}/sw.js must be served with no-store.`);
  console.log(JSON.stringify({ origin, name: manifest.name, startUrl: manifest.start_url, workerCacheControl: cacheControl }));
}
