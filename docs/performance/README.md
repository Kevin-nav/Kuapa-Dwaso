# Performance benchmarking

Kuapa Dwaso uses repeatable Lighthouse mobile runs to quantify page speed under a simulated constrained network and CPU. Run at least three times and compare medians; a single run is too sensitive to local machine noise.

## What is automated now

| Profile    |  Download |     Upload | Latency | CPU | Method                                   |
| ---------- | --------: | ---------: | ------: | --: | ---------------------------------------- |
| `standard` | 1.47 Mbps | 0.675 Mbps |  150 ms |  4× | Lighthouse simulated baseline, unchanged |
| `ghana`    |    8 Mbps |     3 Mbps |  120 ms |  4× | DevTools throttling                      |
| `poor`     |    1 Mbps |   0.4 Mbps |  180 ms |  4× | DevTools throttling                      |
| `stress`   |    1 Mbps |   0.4 Mbps |  180 ms |  6× | DevTools throttling                      |

The Ghana, poor, and stress profiles approximate bandwidth, fixed latency, and CPU only. They do not include the proposed jitter or packet loss; every generated summary records both as `null` so the limitation cannot be mistaken for a completed test.

Every Lighthouse run is cold-cache: Lighthouse clears browser storage and launches a fresh browser profile. Warm-cache testing requires a persistent-browser harness and is listed under deferred work below.

## Capture one benchmark

Build and start the target app in production mode, then run:

```text
corepack pnpm benchmark:performance -- --url http://127.0.0.1:3000 --label homepage-standard --profile standard --runs 3
```

Change `--profile` to `ghana`, `poor`, or `stress` without changing the standard baseline.

## Run the profile and route matrix

Run all four profiles against one route:

```text
corepack pnpm benchmark:profiles -- --target homepage=http://127.0.0.1:3000 --runs 3
```

Run selected profiles against multiple already-running local production apps:

```text
corepack pnpm benchmark:profiles -- --target homepage=http://127.0.0.1:3000 --target auth=http://127.0.0.1:3001 --profiles standard,poor,stress --runs 3
```

Public and unauthenticated routes can be measured immediately. Authenticated buyer, farmer, transporter, search, filtering, and order flows need seeded accounts plus scripted browser actions before their results are meaningful.

## Compare captures

To compare two captured summaries:

```text
corepack pnpm benchmark:compare -- --before docs/performance/results/homepage-before-summary.json --after docs/performance/results/homepage-after-summary.json --output docs/performance/homepage-comparison.md
```

Raw Lighthouse reports and local summary JSON files live in `docs/performance/results/` and are ignored by Git. Commit a concise comparison Markdown report when a result is worth communicating.

## Reporting rules

- State the route, build, Lighthouse version, throttling profile, run count, and median.
- Report transferred bytes, LCP, FCP, Speed Index, blocking time, and request count together.
- Also record failed requests, image requests and bytes, last-image completion time, long-task count, and longest task.
- Say “measured in our lab” rather than promising every user the same percentage.
- Do not mix cold and warm runs or compare development mode with production mode.
- Add production Core Web Vitals later; lab results explain engineering impact, while field results show what real users experience.

## Lighthouse mobile conditions

Lighthouse 13's default simulated-mobile profile currently uses a 412 × 823 viewport at 1.75 device pixel ratio, 4× CPU slowdown, 150 ms RTT, approximately 1.47 Mbps download, and 0.675 Mbps upload. Confirm these values in each raw report's `configSettings` before publishing because Lighthouse defaults can change between versions.

Local runs do not reproduce Ghanaian carrier packet loss, radio handoffs, geographic origin latency, or Cloudflare edge-cache behavior. Once production traffic is available, pair these controlled benchmarks with p75 Core Web Vitals segmented by route, device class, and effective connection type.

## Deferred network-resilience harness

The following feedback is valuable but should not be represented as Lighthouse coverage:

- 1–2% packet loss and ±10–25 ms jitter using an approved Windows network-shaping tool.
- Five-run medians for the packet-loss and jitter profiles.
- Persistent-browser cold-versus-warm cache comparison.
- Good → offline for 2–5 seconds → poor → good recovery testing.
- Dynamic 8 Mbps → 1 Mbps → offline → restored network transitions.
- Scripted interactions for INP, searching, filtering, navigation, and form entry.
- Authenticated buyer/farmer/transporter flows with seeded, non-production test accounts.
- R2 image cold/warm behavior after the public image domain and transformed variants exist.

Those tests need privileged network shaping and a persistent browser automation session. They should capture failed and retried requests, recovery state, important-image completion, interaction latency, and screenshots or traces when a flow becomes stuck.
