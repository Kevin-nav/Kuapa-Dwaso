/* eslint-disable @next/next/no-img-element */
import type { PublicBlogPost } from "./data";

const categoryNames = {
  visits: "Field visit",
  partnerships: "Partnership",
  events: "Event",
  updates: "Update",
} as const;
export function StoryCard({
  post,
  featured = false,
}: {
  post: PublicBlogPost;
  featured?: boolean;
}) {
  return (
    <article
      className={featured ? "blog-card blog-card--featured" : "blog-card"}
    >
      <a href={`/blog/${post.slug}`} className="blog-card__image">
        <img
          loading={featured ? "eager" : "lazy"}
          src={post.heroImageUrl}
          alt={post.heroImageAlt}
        />
      </a>
      <div className="blog-card__body">
        <p className="blog-meta">
          <span>{categoryNames[post.category]}</span>
          <time
            dateTime={new Date(
              post.publishedAt ?? post.createdAt,
            ).toISOString()}
          >
            {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
              post.publishedAt ?? post.createdAt,
            )}
          </time>
        </p>
        <h2>
          <a href={`/blog/${post.slug}`}>{post.title}</a>
        </h2>
        <p>{post.excerpt}</p>
        <a className="blog-read" href={`/blog/${post.slug}`}>
          Read the story <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}
