/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  officialContactEmail,
  officialContactHref,
  publicSiteUrl,
} from "@kuapa-dwaso/config";
import { SiteHeader } from "../../site-header";
import { SiteFooter } from "../../site-footer";
import { getPost, getRelatedPosts } from "../data";
import { ShareActions } from "../share-actions";
import { StoryCard } from "../story-card";
import { StoryContent } from "../story-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  const url = `${publicSiteUrl}/blog/${post.slug}`;
  return {
    title: `${post.title} | Kuapa Dwaso`,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      type: "article",
      publishedTime: post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : undefined,
      modifiedTime: new Date(post.updatedAt).toISOString(),
      images: [{ url: post.heroImageUrl, alt: post.heroImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.heroImageUrl],
    },
  };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const related = await getRelatedPosts(post);
  const appUrl = process.env.PUBLIC_APP_URL ?? "https://app.kuapadwaso.com";
  const canonical = `${publicSiteUrl}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: [post.heroImageUrl],
    datePublished: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : undefined,
    dateModified: new Date(post.updatedAt).toISOString(),
    author: { "@type": "Organization", name: post.authorName },
    publisher: {
      "@type": "Organization",
      name: "Kuapa Dwaso",
      url: publicSiteUrl,
    },
    mainEntityOfPage: canonical,
  };
  return (
    <div className="blog-shell">
      <SiteHeader
        joinHref={new URL("/signup", appUrl).toString()}
        loginHref={appUrl}
      />
      <main>
        <article className="blog-article">
          <header>
            <a className="blog-back" href="/blog">
              ← All stories
            </a>
            <p className="blog-meta">
              <span>{post.category}</span>
              <time>
                {new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
                  post.publishedAt ?? post.createdAt,
                )}
              </time>
            </p>
            <h1>{post.title}</h1>
            <p className="blog-deck">{post.excerpt}</p>
            <div className="blog-byline">
              <span>By {post.authorName}</span>
              {post.location ? <span>{post.location}</span> : null}
              {post.occurredAt ? (
                <span>
                  Story date:{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "medium",
                  }).format(post.occurredAt)}
                </span>
              ) : null}
            </div>
          </header>
          <figure className="blog-hero-image">
            <img src={post.heroImageUrl} alt={post.heroImageAlt} />
            {post.heroImageCaption ? (
              <figcaption>{post.heroImageCaption}</figcaption>
            ) : null}
          </figure>
          <div className="blog-article__layout">
            <ShareActions title={post.title} url={canonical} />
            <StoryContent blocks={post.content} />
          </div>
          <aside className="blog-contact">
            <p className="eyebrow">Start a conversation</p>
            <h2>Would you like to visit, partner, or work with Kuapa Dwaso?</h2>
            <a href={officialContactHref}>
              {officialContactEmail} <span aria-hidden="true">↗</span>
            </a>
          </aside>
        </article>
        {related.length ? (
          <section className="blog-related">
            <p className="eyebrow">Continue reading</p>
            <h2>More from Kuapa Dwaso</h2>
            <div className="blog-related__grid">
              {related.map((item) => (
                <StoryCard post={item} key={item._id} />
              ))}
            </div>
          </section>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </main>
      <SiteFooter appAuthHref={new URL("/signup", appUrl).toString()} />
    </div>
  );
}
