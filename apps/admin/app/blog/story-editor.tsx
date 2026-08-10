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
import { BlockEditor, blogBlockLabels } from "./block-editor";
import { ContentPreview } from "./content-preview";
import { uploadBlogImage } from "./upload-blog-image";

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
    principal?.role === "admin" && principal.status === "active"
      ? (principal.userId as Id<"users">)
      : undefined;
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
  const editVersion = useRef(0);
  const uploadAbortController = useRef<AbortController | null>(null);
  if (uploadAbortController.current === null) {
    uploadAbortController.current = new AbortController();
  }

  useEffect(
    () => () => {
      uploadAbortController.current?.abort();
    },
    [],
  );

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

  const save = async (): Promise<boolean> => {
    if (actorUserId === undefined) return false;
    const savingVersion = editVersion.current;
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
      if (editVersion.current === savingVersion) setDirty(false);
      setMessage("Draft saved");
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save the story.",
      );
      return false;
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
  }, [dirty, postId, payload, saving]);

  const markDirty = () => {
    editVersion.current += 1;
    setDirty(true);
  };

  const change = <K extends keyof EditorState>(
    key: K,
    value: EditorState[K],
  ) => {
    setState((current) => ({ ...current, [key]: value }));
    markDirty();
  };
  const changeContent = (
    update: (current: BlogContentBlock[]) => BlogContentBlock[],
  ) => {
    setState((current) => ({
      ...current,
      content: update(current.content),
    }));
    markDirty();
  };
  const updateBlock = (
    index: number,
    update:
      | BlogContentBlock
      | ((current: BlogContentBlock) => BlogContentBlock),
  ) =>
    changeContent((content) =>
      content.map((block, itemIndex) =>
        itemIndex === index
          ? typeof update === "function"
            ? update(block)
            : update
          : block,
      ),
    );
  const addBlock = (type: keyof typeof blogBlockLabels) => {
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
    changeContent((content) => [...content, next]);
  };

  const uploadImage = async (
    file: File,
    purpose: "blog_hero_image" | "blog_content_image",
  ) => {
    if (postId === undefined)
      throw new Error("Save the story once before uploading images.");
    const token = await firebaseUser?.getIdToken();
    if (!token) throw new Error("Sign in again before uploading.");
    return uploadBlogImage({
      file,
      purpose,
      postId,
      token,
      signal: uploadAbortController.current!.signal,
    });
  };

  const showError = (error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    setMessage(error instanceof Error ? error.message : String(error));
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
                void unpublish({ actorUserId, blogPostId: postId })
                  .then(() => setStatus("draft"))
                  .catch(showError)
              }
            >
              Unpublish
            </button>
          ) : postId ? (
            <button
              className="story-button story-button--primary"
              onClick={() =>
                void (async () => {
                  if (!(await save())) return;
                  try {
                    await publish({ actorUserId, blogPostId: postId });
                    setStatus("published");
                  } catch (error) {
                    showError(error);
                  }
                })()
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
                    .catch(showError);
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
            {Object.entries(blogBlockLabels).map(([type, label]) => (
              <button
                type="button"
                key={type}
                onClick={() => addBlock(type as keyof typeof blogBlockLabels)}
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
                disabled={postId === undefined}
                onChange={(next) => updateBlock(index, next)}
                onError={showError}
                onRemove={() =>
                  changeContent((content) =>
                    content.filter((_, itemIndex) => itemIndex !== index),
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
