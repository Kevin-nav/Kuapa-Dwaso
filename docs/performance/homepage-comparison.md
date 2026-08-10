# Kuapa Dwaso performance benchmark

Generated 2026-08-10T15:54:01.367Z from the median of 3 before runs and 3 after runs using Lighthouse mobile defaults (simulated slow network and CPU).

## Test conditions

| Condition              | Value                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application            | Optimized Next.js production build served with `next start` on localhost                                                                           |
| Route                  | Public homepage `/`; unauthenticated                                                                                                               |
| Runner                 | Lighthouse 13.0.1, Headless Chrome 151, Windows 10 user agent                                                                                      |
| Emulated device        | Mobile viewport 412 × 823 CSS px, device pixel ratio 1.75                                                                                          |
| CPU                    | 4× simulated slowdown                                                                                                                              |
| Network                | Simulated 150 ms RTT, 1.47 Mbps download, 0.675 Mbps upload; Lighthouse request latency 562.5 ms                                                   |
| Sampling               | Median of three runs for each version                                                                                                              |
| Browser/cache behavior | Fresh headless browser profile per run; the same local application server remains running, so server-side image caches can warm within each series |

This is a controlled lab comparison, not a measurement from a Ghanaian mobile carrier. Localhost excludes real origin geography, Cloudflare/R2 edge behavior, radio handoffs, packet loss, and service-worker effects. Background activity on the development machine can also affect CPU timing, which is why medians are used.

| Metric                   |      Before |       After | Improvement |
| ------------------------ | ----------: | ----------: | ----------: |
| Performance score        |   82 points |   94 points |      +14.6% |
| Largest Contentful Paint |    3,488 ms |    2,971 ms |      +14.8% |
| First Contentful Paint   |    1,188 ms |      770 ms |      +35.2% |
| Speed Index              |    1,944 ms |      770 ms |      +60.4% |
| Total Blocking Time      |      134 ms |       76 ms |      +43.7% |
| Transferred data         |     0.39 MB |     0.38 MB |       +4.6% |
| Network requests         | 14 requests | 14 requests |       +0.0% |

## Investor-readable takeaway

Under the same simulated constrained-mobile conditions, the measured page showed its first content 35.2% sooner, visually completed 60.4% faster, reached its largest visible content 14.8% sooner, and transferred 4.6% less data. The Lighthouse performance score moved from 82 to 94.

Total Blocking Time improved from 134 ms to 76 ms. The earlier image-only result was 222 ms; inspection traced its longest task to React DOM startup. Converting the scroll-aware header into a server component removed its hydration and scroll-listener work, cutting blocking time by 66.0% from that intermediate result.

These are repeatable lab measurements, not guarantees for every device or carrier. Production field data should be reported separately once enough real visits are available.

## Image payload changes

- The two homepage source photographs fell from 5.87 MB of PNGs to 0.41 MB of WebP assets: 93.1% smaller before responsive delivery.
- Each authentication background fell from 2.81 MB to 0.18 MB: 93.5% smaller. The versioned WebP is cached for one year.
- An unused duplicate authentication PNG was removed, so the repository no longer carries three copies of the same 2.81 MB file.

Next.js still selects a responsive image size for each screen. This is why the measured homepage transfer reduction is smaller than the source-file reduction: the previous runtime already converted PNGs on demand, while the new assets reduce origin storage, cold optimization work, build/deploy weight, and direct background-image downloads.
