import type { Metadata } from "next";
import { SiteHeader } from "../site-header";
import { SiteFooter } from "../site-footer";
import { getPublishedPosts } from "./data";
import { StoryCard } from "./story-card";

export const metadata: Metadata = {
  title: "Stories & Insights | Kuapa Dwaso",
  description:
    "Field visits, prospective collaboration discussions, events, and pilot updates from Kuapa Dwaso.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Kuapa Dwaso Stories & Insights",
    description: "Field notes and official updates from Kuapa Dwaso.",
    type: "website",
  },
};
const categories = [
  ["all", "All stories"],
  ["visits", "Visits"],
  ["partnerships", "Partnership discussions"],
  ["events", "Events"],
  ["updates", "Updates"],
] as const;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const result = await getPublishedPosts(params.category, params.cursor);
  const [featured, ...posts] = result.items;
  const appUrl = process.env.PUBLIC_APP_URL ?? "https://app.kuapadwaso.com";
  return (
    <div className="blog-shell">
      <SiteHeader
        joinHref={new URL("/signup", appUrl).toString()}
        loginHref={appUrl}
        isStoriesPath
      />
      <main>
        <header className="blog-masthead">
          <div>
            <p className="eyebrow">Stories &amp; Insights</p>
            <h1>
              Stories of produce,
              <br />
              <em>people, and progress.</em>
            </h1>
          </div>
          <p>
            Field notes from market and warehouse visits, prospective partnerships, community
            events, and the work moving Ghanaian produce closer to market.
          </p>
        </header>
        <nav className="blog-filters" aria-label="Story categories">
          {categories.map(([value, label]) => (
            <a
              aria-current={
                (params.category ?? "all") === value ? "page" : undefined
              }
              key={value}
              href={value === "all" ? "/blog" : `/blog?category=${value}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <section className="blog-grid" aria-live="polite">
          {featured ? (
            <StoryCard post={featured} featured />
          ) : (
            <div className="blog-empty">
              <p className="eyebrow">Stories &amp; Insights</p>
              <h2>Our first field story is being prepared.</h2>
              <p>
                Come back for field visits, collaboration discussions, events, and Kuapa
                Dwaso updates.
              </p>
            </div>
          )}
          {posts.map((post) => (
            <StoryCard key={post._id} post={post} />
          ))}
        </section>
        {result.nextCursor ? (
          <a
            className="blog-more"
            href={`/blog?${params.category ? `category=${encodeURIComponent(params.category)}&` : ""}cursor=${encodeURIComponent(result.nextCursor)}`}
          >
            Older stories
          </a>
        ) : null}
      </main>
      <SiteFooter appAuthHref={new URL("/signup", appUrl).toString()} />
    </div>
  );
}
