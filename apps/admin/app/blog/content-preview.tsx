/* eslint-disable @next/next/no-img-element */

import type { BlogContentBlock } from "@kuapa-dwaso/types";

/** Renders the current structured story content inside the admin preview. */
export function ContentPreview({ blocks }: { blocks: BlogContentBlock[] }) {
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
              {block.items.map((item, index) => (
                <li key={index}>{item.map((part) => part.text).join("")}</li>
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
