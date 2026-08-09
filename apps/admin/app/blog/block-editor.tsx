/* eslint-disable @next/next/no-img-element */

import type { BlogContentBlock } from "@kuapa-dwaso/types";
import type { UploadedBlogImage } from "./upload-blog-image";

export const blogBlockLabels = {
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

type BlockUpdate =
  | BlogContentBlock
  | ((current: BlogContentBlock) => BlogContentBlock);

type BlockEditorProps = {
  block: BlogContentBlock;
  disabled: boolean;
  onChange: (update: BlockUpdate) => void;
  onError: (error: unknown) => void;
  onRemove: () => void;
  upload: (file: File) => Promise<UploadedBlogImage>;
};

/** Edits one structured story block while keeping media failures recoverable. */
export function BlockEditor({
  block,
  disabled,
  onChange,
  onError,
  onRemove,
  upload,
}: BlockEditorProps) {
  return (
    <div className="story-block">
      <div className="story-block__head">
        <strong>{blogBlockLabels[block.type]}</strong>
        <button type="button" onClick={onRemove}>
          Remove
        </button>
      </div>
      {"content" in block ? (
        <>
          <textarea
            rows={block.type === "paragraph" ? 5 : 2}
            value={block.content.map((item) => item.text).join("")}
            onChange={(event) =>
              onChange({
                ...block,
                content: [{ ...block.content[0], text: event.target.value }],
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
              onChange={(event) =>
                onChange({
                  ...block,
                  content: [
                    {
                      ...(block.content[0] ?? { text: "" }),
                      href: event.target.value || undefined,
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
          onChange={(event) =>
            onChange({
              ...block,
              items: event.target.value
                .split("\n")
                .map((item) => [{ text: item }]),
            })
          }
        />
      ) : block.type === "image" ? (
        <>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void upload(file)
                .then((image) =>
                  onChange((current) =>
                    current.type === "image"
                      ? { ...current, ...image }
                      : current,
                  ),
                )
                .catch(onError);
            }}
          />
          {block.url ? <img src={block.url} alt="" /> : null}
          <input
            placeholder="Alternative text"
            value={block.alt}
            onChange={(event) =>
              onChange({ ...block, alt: event.target.value })
            }
          />
          <input
            placeholder="Caption"
            value={block.caption ?? ""}
            onChange={(event) =>
              onChange({
                ...block,
                caption: event.target.value || undefined,
              })
            }
          />
        </>
      ) : block.type === "gallery" ? (
        <>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              if (files.length === 0) return;
              void Promise.all(files.map(upload))
                .then((images) =>
                  onChange((current) =>
                    current.type === "gallery"
                      ? {
                          ...current,
                          images: [
                            ...current.images,
                            ...images.map((image) => ({ ...image, alt: "" })),
                          ],
                        }
                      : current,
                  ),
                )
                .catch(onError);
            }}
          />
          {block.images.map((image, index) => (
            <div className="story-gallery-edit" key={`${image.url}-${index}`}>
              <img src={image.url} alt="" />
              <input
                placeholder="Required alternative text"
                value={image.alt}
                onChange={(event) =>
                  onChange({
                    ...block,
                    images: block.images.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, alt: event.target.value }
                        : item,
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
            onChange={(event) =>
              onChange({ ...block, url: event.target.value })
            }
          />
          <input
            placeholder="Video title"
            value={block.title}
            onChange={(event) =>
              onChange({ ...block, title: event.target.value })
            }
          />
        </>
      )}
    </div>
  );
}
