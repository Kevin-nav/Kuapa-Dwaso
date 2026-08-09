"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { BlogCategory, BlogContentBlock } from "@kuapa-dwaso/types";
import { normalizeBlogSlug } from "@kuapa-dwaso/validators";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAdminAuth } from "../auth/AdminAuthProvider";

type EditorState = {
  title: string;
  slug: string;
  excerpt: string;
  category: BlogCategory;
  content: BlogContentBlock[];
  heroImageUrl: string;
  heroImageAlt: string;
  heroImageCaption: string;
  heroUploadAssetId: Id<"uploadAssets"> | undefined;
  authorName: string;
  location: string;
  occurredAt: string;
};

const emptyState: EditorState = {
  title: "",
  slug: "",
  excerpt: "",
  category: "updates",
  content: [],
  heroImageUrl: "",
  heroImageAlt: "",
  heroImageCaption: "",
  heroUploadAssetId: undefined,
  authorName: "Kuapa Dwaso Team",
  location: "",
  occurredAt: "",
};
const blockLabels = {
  paragraph: "Paragraph",
  heading2: "Heading",
  heading3: "Subheading",
  quote: "Quote",
  bulletList: "Bullet list",
  numberedList: "Numbered list",
  image: "Image",
  gallery: "Gallery",
  video: "Video",
} as const;

function blockId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
function textBlock(
  type: "paragraph" | "heading2" | "heading3" | "quote",
): BlogContentBlock {
  return { id: blockId(), type, content: [{ text: "" }] };
}

export function StoryEditor({
  postId: initialPostId,
}: {
  postId?: Id<"blogPosts">;
}) {
  const { firebaseUser, principal } = useAdminAuth();
  const actorUserId =
    principal?.role === "admin" ? (principal.userId as Id<"users">) : undefined;
  const existing = useQuery(
    api.blogPosts.getForAdmin,
    actorUserId === undefined || initialPostId === undefined
      ? "skip"
      : { actorUserId, blogPostId: initialPostId },
  );
  const createDraft = useMutation(api.blogPosts.createDraft);
  const updateDraft = useMutation(api.blogPosts.updateDraft);
  const publish = useMutation(api.blogPosts.publish);
  const unpublish = useMutation(api.blogPosts.unpublish);
  const [postId, setPostId] = useState(initialPostId);
  const [state, setState] = useState<EditorState>(emptyState);
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    "draft",
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const initializedId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (
      existing === undefined ||
      existing === null ||
      initializedId.current === existing._id
    )
      return;
    initializedId.current = existing._id;
    setPostId(existing._id);
    setStatus(existing.status);
    setState({
      title: existing.title,
      slug: existing.slug,
      excerpt: existing.excerpt,
      category: existing.category,
      content: existing.content,
      heroImageUrl: existing.heroImageUrl,
      heroImageAlt: existing.heroImageAlt,
      heroImageCaption: existing.heroImageCaption ?? "",
      heroUploadAssetId: existing.heroUploadAssetId,
      authorName: existing.authorName,
      location: existing.location ?? "",
      occurredAt: existing.occurredAt
        ? new Date(existing.occurredAt).toISOString().slice(0, 10)
        : "",
    });
  }, [existing]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const payload = useMemo(
    () => ({
      title: state.title,
      slug: state.slug || normalizeBlogSlug(state.title),
      excerpt: state.excerpt,
      category: state.category,
      content: state.content,
      heroImageUrl: state.heroImageUrl,
      heroImageAlt: state.heroImageAlt,
      ...(state.heroImageCaption
        ? { heroImageCaption: state.heroImageCaption }
        : {}),
      ...(state.heroUploadAssetId
        ? { heroUploadAssetId: state.heroUploadAssetId }
        : {}),
      authorName: state.authorName,
      ...(state.location ? { location: state.location } : {}),
      ...(state.occurredAt
        ? { occurredAt: new Date(`${state.occurredAt}T12:00:00Z`).getTime() }
        : {}),
    }),
    [state],
  );

  const save = async () => {
    if (actorUserId === undefined) return;
    setSaving(true);
    setMessage("");
    try {
      if (postId === undefined) {
        const id = await createDraft({
          actorUserId,
          ...payload,
          content: payload.content as never,
        });
        setPostId(id);
        window.history.replaceState(null, "", `/blog/${id}/edit`);
      } else
        await updateDraft({
          actorUserId,
          blogPostId: postId,
          ...payload,
          content: payload.content as never,
        });
      setDirty(false);
      setMessage("Draft saved");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save the story.",
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!dirty || postId === undefined || saving) return;
    const timer = window.setTimeout(() => {
      void save();
    }, 1800);
    return () => window.clearTimeout(timer);
    // payload intentionally captures the current editor snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, postId, payload]);

  const change = <K extends keyof EditorState>(
    key: K,
    value: EditorState[K],
  ) => {
    setState((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  const updateBlock = (index: number, next: BlogContentBlock) =>
    change(
      "content",
      state.content.map((block, i) => (i === index ? next : block)),
    );
  const addBlock = (type: keyof typeof blockLabels) => {
    const next: BlogContentBlock =
      type === "paragraph" ||
      type === "heading2" ||
      type === "heading3" ||
      type === "quote"
        ? textBlock(type)
        : type === "bulletList" || type === "numberedList"
          ? { id: blockId(), type, items: [[{ text: "" }]] }
          : type === "image"
            ? { id: blockId(), type, url: "", alt: "" }
            : type === "gallery"
              ? { id: blockId(), type, images: [] }
              : { id: blockId(), type: "video", url: "", title: "" };
    change("content", [...state.content, next]);
  };

  const uploadImage = async (
    file: File,
    purpose: "blog_hero_image" | "blog_content_image",
  ) => {
    if (postId === undefined)
      throw new Error("Save the story once before uploading images.");
    const token = await firebaseUser?.getIdToken();
    if (!token) throw new Error("Sign in again before uploading.");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const presign = await fetch(`${apiUrl}/uploads/presign`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        purpose,
        contentType: file.type,
        sizeBytes: file.size,
        fileName: file.name,
        relatedEntityType: "blog_post",
        relatedEntityId: postId,
        accessLevel: "public_read",
      }),
    });
    if (!presign.ok) throw new Error(await presign.text());
    const target = (await presign.json()) as {
      uploadAssetId: Id<"uploadAssets">;
      uploadUrl: string;
      headers: Record<string, string>;
    };
    const put = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: target.headers,
      body: file,
    });
    if (!put.ok) throw new Error("The image could not be uploaded.");
    const complete = await fetch(`${apiUrl}/uploads/complete`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        uploadAssetId: target.uploadAssetId,
        sizeBytes: file.size,
      }),
    });
    if (!complete.ok) throw new Error(await complete.text());
    const read = await fetch(`${apiUrl}/uploads/presign-read`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ uploadAssetId: target.uploadAssetId }),
    });
    if (!read.ok) throw new Error(await read.text());
    const readable = (await read.json()) as { readUrl: string };
    return { url: readable.readUrl, uploadAssetId: target.uploadAssetId };
  };

  if (actorUserId === undefined)
    return (
      <main className="story-admin">
        <p>Platform owner access is required.</p>
      </main>
    );
  return (
    <main className="story-admin story-editor">
      <header className="story-admin__header">
        <div>
          <Link href="/blog" className="story-kicker">
            ← Editorial desk
          </Link>
          <h1>{postId ? "Edit story" : "Write a story"}</h1>
          <p>{message || (dirty ? "Unsaved changes" : "All changes saved")}</p>
        </div>
        <div className="story-row__actions">
          <button
            className="story-button"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {postId && status === "published" ? (
            <button
              className="story-button"
              onClick={() =>
                void unpublish({ actorUserId, blogPostId: postId }).then(() =>
                  setStatus("draft"),
                )
              }
            >
              Unpublish
            </button>
          ) : postId ? (
            <button
              className="story-button story-button--primary"
              onClick={() =>
                void save()
                  .then(() => publish({ actorUserId, blogPostId: postId }))
                  .then(() => setStatus("published"))
                  .catch((error) =>
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Could not publish.",
                    ),
                  )
              }
            >
              Publish
            </button>
          ) : null}
        </div>
      </header>
      <div className="story-editor__grid">
        <section className="story-editor__form">
          <label>
            Title
            <input
              value={state.title}
              maxLength={140}
              onChange={(e) => {
                change("title", e.target.value);
                if (!postId) change("slug", normalizeBlogSlug(e.target.value));
              }}
            />
          </label>
          <div className="story-form-grid">
            <label>
              Slug
              <input
                value={state.slug}
                disabled={status === "published"}
                onChange={(e) =>
                  change("slug", normalizeBlogSlug(e.target.value))
                }
              />
            </label>
            <label>
              Category
              <select
                value={state.category}
                onChange={(e) =>
                  change("category", e.target.value as BlogCategory)
                }
              >
                <option value="visits">Visits</option>
                <option value="partnerships">Partnerships</option>
                <option value="events">Events</option>
                <option value="updates">Updates</option>
              </select>
            </label>
          </div>
          <label>
            Summary
            <textarea
              rows={3}
              maxLength={320}
              value={state.excerpt}
              onChange={(e) => change("excerpt", e.target.value)}
            />
          </label>
          <div className="story-form-grid">
            <label>
              Author
              <input
                value={state.authorName}
                onChange={(e) => change("authorName", e.target.value)}
              />
            </label>
            <label>
              Location
              <input
                value={state.location}
                onChange={(e) => change("location", e.target.value)}
              />
            </label>
            <label>
              Story date
              <input
                type="date"
                value={state.occurredAt}
                onChange={(e) => change("occurredAt", e.target.value)}
              />
            </label>
          </div>
          <fieldset>
            <legend>Hero image</legend>
            {state.heroImageUrl ? (
              <img
                className="story-editor__hero"
                src={state.heroImageUrl}
                alt=""
              />
            ) : null}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!postId}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void uploadImage(file, "blog_hero_image")
                    .then((image) => {
                      change("heroImageUrl", image.url);
                      change("heroUploadAssetId", image.uploadAssetId);
                    })
                    .catch((error) => setMessage(String(error)));
              }}
            />
            <small>
              {postId
                ? "JPEG, PNG, or WebP up to the configured upload limit."
                : "Save once to enable image uploads."}
            </small>
            <label>
              Alternative text
              <input
                value={state.heroImageAlt}
                onChange={(e) => change("heroImageAlt", e.target.value)}
              />
            </label>
            <label>
              Caption
              <input
                value={state.heroImageCaption}
                onChange={(e) => change("heroImageCaption", e.target.value)}
              />
            </label>
          </fieldset>
          <div className="story-block-toolbar" aria-label="Add content block">
            {Object.entries(blockLabels).map(([type, label]) => (
              <button
                type="button"
                key={type}
                onClick={() => addBlock(type as keyof typeof blockLabels)}
              >
                + {label}
              </button>
            ))}
          </div>
          <div className="story-blocks">
            {state.content.map((block, index) => (
              <BlockEditor
                key={block.id}
                block={block}
                onChange={(next) => updateBlock(index, next)}
                onRemove={() =>
                  change(
                    "content",
                    state.content.filter((_, i) => i !== index),
                  )
                }
                upload={(file) => uploadImage(file, "blog_content_image")}
              />
            ))}
          </div>
        </section>
        <aside className="story-preview">
          <span className="story-kicker">Live preview</span>
          {state.heroImageUrl ? (
            <img src={state.heroImageUrl} alt={state.heroImageAlt} />
          ) : (
            <div className="story-preview__placeholder">Hero photograph</div>
          )}
          <p className="story-category">{state.category}</p>
          <h2>{state.title || "Your story title"}</h2>
          <p>{state.excerpt || "The story summary will appear here."}</p>
          <ContentPreview blocks={state.content} />
        </aside>
      </div>
    </main>
  );
}

function BlockEditor({
  block,
  onChange,
  onRemove,
  upload,
}: {
  block: BlogContentBlock;
  onChange: (block: BlogContentBlock) => void;
  onRemove: () => void;
  upload: (
    file: File,
  ) => Promise<{ url: string; uploadAssetId: Id<"uploadAssets"> }>;
}) {
  return (
    <div className="story-block">
      <div className="story-block__head">
        <strong>{blockLabels[block.type]}</strong>
        <button type="button" onClick={onRemove}>
          Remove
        </button>
      </div>
      {"content" in block ? (
        <>
          <textarea
            rows={block.type === "paragraph" ? 5 : 2}
            value={block.content.map((item) => item.text).join("")}
            onChange={(e) =>
              onChange({
                ...block,
                content: [{ ...block.content[0], text: e.target.value }],
              })
            }
          />
          <div className="story-format">
            <button
              type="button"
              aria-pressed={block.content[0]?.marks?.includes("bold")}
              onClick={() => {
                const first = block.content[0] ?? { text: "" };
                const marks = new Set(first.marks ?? []);
                if (marks.has("bold")) marks.delete("bold");
                else marks.add("bold");
                onChange({
                  ...block,
                  content: [{ ...first, marks: [...marks] }],
                });
              }}
            >
              Bold
            </button>
            <button
              type="button"
              aria-pressed={block.content[0]?.marks?.includes("italic")}
              onClick={() => {
                const first = block.content[0] ?? { text: "" };
                const marks = new Set(first.marks ?? []);
                if (marks.has("italic")) marks.delete("italic");
                else marks.add("italic");
                onChange({
                  ...block,
                  content: [{ ...first, marks: [...marks] }],
                });
              }}
            >
              Italic
            </button>
            <input
              aria-label="Link URL"
              placeholder="Optional link URL"
              value={block.content[0]?.href ?? ""}
              onChange={(e) =>
                onChange({
                  ...block,
                  content: [
                    {
                      ...(block.content[0] ?? { text: "" }),
                      href: e.target.value || undefined,
                    },
                  ],
                })
              }
            />
          </div>
        </>
      ) : "items" in block ? (
        <textarea
          rows={5}
          value={block.items
            .map((item) => item.map((part) => part.text).join(""))
            .join("\n")}
          onChange={(e) =>
            onChange({
              ...block,
              items: e.target.value.split("\n").map((item) => [{ text: item }]),
            })
          }
        />
      ) : block.type === "image" ? (
        <>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void upload(file).then((image) =>
                  onChange({ ...block, ...image }),
                );
            }}
          />
          {block.url ? <img src={block.url} alt="" /> : null}
          <input
            placeholder="Alternative text"
            value={block.alt}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
          />
          <input
            placeholder="Caption"
            value={block.caption ?? ""}
            onChange={(e) =>
              onChange({ ...block, caption: e.target.value || undefined })
            }
          />
        </>
      ) : block.type === "gallery" ? (
        <>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              void Promise.all(files.map(upload)).then((images) =>
                onChange({
                  ...block,
                  images: [
                    ...block.images,
                    ...images.map((image) => ({ ...image, alt: "" })),
                  ],
                }),
              );
            }}
          />
          {block.images.map((image, i) => (
            <div className="story-gallery-edit" key={`${image.url}-${i}`}>
              <img src={image.url} alt="" />
              <input
                placeholder="Required alternative text"
                value={image.alt}
                onChange={(e) =>
                  onChange({
                    ...block,
                    images: block.images.map((item, j) =>
                      j === i ? { ...item, alt: e.target.value } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
        </>
      ) : (
        <>
          <input
            placeholder="YouTube or Vimeo URL"
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
          />
          <input
            placeholder="Video title"
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
          />
        </>
      )}
    </div>
  );
}

function ContentPreview({ blocks }: { blocks: BlogContentBlock[] }) {
  return (
    <div className="story-preview__body">
      {blocks.map((block) => {
        if ("content" in block) {
          const text = block.content.map((part) => part.text).join("");
          if (block.type === "heading2") return <h3 key={block.id}>{text}</h3>;
          if (block.type === "heading3") return <h4 key={block.id}>{text}</h4>;
          if (block.type === "quote")
            return <blockquote key={block.id}>{text}</blockquote>;
          return <p key={block.id}>{text}</p>;
        }
        if ("items" in block) {
          const Tag = block.type === "bulletList" ? "ul" : "ol";
          return (
            <Tag key={block.id}>
              {block.items.map((item, i) => (
                <li key={i}>{item.map((part) => part.text).join("")}</li>
              ))}
            </Tag>
          );
        }
        if (block.type === "image")
          return block.url ? (
            <figure key={block.id}>
              <img src={block.url} alt={block.alt} />
              <figcaption>{block.caption}</figcaption>
            </figure>
          ) : null;
        if (block.type === "gallery")
          return (
            <div className="story-preview__gallery" key={block.id}>
              {block.images.map((image) => (
                <img key={image.url} src={image.url} alt={image.alt} />
              ))}
            </div>
          );
        return (
          <a key={block.id} href={block.url}>
            {block.title || "Video"}
          </a>
        );
      })}
    </div>
  );
}
