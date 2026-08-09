"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAdminAuth } from "../auth/AdminAuthProvider";

type StoryStatus = "draft" | "published" | "archived";

export default function StoriesPage() {
  const { principal } = useAdminAuth();
  const actorUserId =
    principal?.role === "admin" ? (principal.userId as Id<"users">) : undefined;
  const [status, setStatus] = useState<StoryStatus | "all">("all");
  const posts = useQuery(
    api.blogPosts.listForAdmin,
    actorUserId === undefined
      ? "skip"
      : {
          actorUserId,
          ...(status === "all" ? {} : { status }),
          limit: 100,
        },
  ) as
    | Array<{
        _id: Id<"blogPosts">;
        title: string;
        excerpt: string;
        slug: string;
        status: StoryStatus;
        category: string;
        updatedAt: number;
      }>
    | undefined;
  const publish = useMutation(api.blogPosts.publish);
  const unpublish = useMutation(api.blogPosts.unpublish);
  const archive = useMutation(api.blogPosts.archive);

  if (actorUserId === undefined)
    return (
      <main className="story-admin">
        <p>Sign in with an active administrator account.</p>
      </main>
    );

  return (
    <main className="story-admin">
      <header className="story-admin__header">
        <div>
          <span className="story-kicker">Editorial desk</span>
          <h1>Stories</h1>
          <p>
            Publish official visits, partnerships, events, and platform updates.
          </p>
        </div>
        <Link className="story-button story-button--primary" href="/blog/new">
          Write a story
        </Link>
      </header>
      <div className="story-tabs" role="tablist" aria-label="Story status">
        {(["all", "draft", "published", "archived"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-selected={status === item}
            onClick={() => setStatus(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <section className="story-list">
        {posts === undefined ? (
          <p>Loading stories…</p>
        ) : posts.length === 0 ? (
          <div className="story-empty">
            <h2>No stories here yet</h2>
            <p>
              Start with a field visit, partnership announcement, event recap,
              or update.
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <article className="story-row" key={post._id}>
              <div>
                <span className={`story-status story-status--${post.status}`}>
                  {post.status}
                </span>
                <span className="story-category">{post.category}</span>
                <h2>{post.title || "Untitled story"}</h2>
                <p>{post.excerpt || "No summary yet."}</p>
                <small>
                  Updated{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(post.updatedAt)}
                </small>
              </div>
              <div className="story-row__actions">
                <Link className="story-button" href={`/blog/${post._id}/edit`}>
                  Edit
                </Link>
                {post.status === "published" ? (
                  <button
                    className="story-button"
                    onClick={() =>
                      void unpublish({ actorUserId, blogPostId: post._id })
                    }
                  >
                    Unpublish
                  </button>
                ) : post.status !== "archived" ? (
                  <button
                    className="story-button story-button--primary"
                    onClick={() =>
                      void publish({ actorUserId, blogPostId: post._id })
                    }
                  >
                    Publish
                  </button>
                ) : null}
                {post.status !== "archived" ? (
                  <button
                    className="story-button story-button--danger"
                    onClick={() =>
                      window.confirm("Archive this story?") &&
                      void archive({ actorUserId, blogPostId: post._id })
                    }
                  >
                    Archive
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
