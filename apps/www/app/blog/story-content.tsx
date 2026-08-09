/* eslint-disable @next/next/no-img-element */
import type { BlogContentBlock, BlogTextSegment } from "@kuapa-dwaso/types";
import { VideoEmbed } from "./video-embed";

function RichText({ content }: { content: BlogTextSegment[] }) {
  return (
    <>
      {content.map((part, index) => {
        let node = <>{part.text}</>;
        if (part.marks?.includes("bold")) node = <strong>{node}</strong>;
        if (part.marks?.includes("italic")) node = <em>{node}</em>;
        return part.href ? (
          <a key={index} href={part.href} rel="noreferrer">
            {node}
          </a>
        ) : (
          <span key={index}>{node}</span>
        );
      })}
    </>
  );
}

export function StoryContent({ blocks }: { blocks: BlogContentBlock[] }) {
  return (
    <div className="blog-prose">
      {blocks.map((block) => {
        if ("content" in block) {
          const content = <RichText content={block.content} />;
          if (block.type === "heading2")
            return <h2 key={block.id}>{content}</h2>;
          if (block.type === "heading3")
            return <h3 key={block.id}>{content}</h3>;
          if (block.type === "quote")
            return <blockquote key={block.id}>{content}</blockquote>;
          return <p key={block.id}>{content}</p>;
        }
        if ("items" in block) {
          const Tag = block.type === "bulletList" ? "ul" : "ol";
          return (
            <Tag key={block.id}>
              {block.items.map((item, index) => (
                <li key={index}>
                  <RichText content={item} />
                </li>
              ))}
            </Tag>
          );
        }
        if (block.type === "image")
          return (
            <figure key={block.id}>
              <img loading="lazy" src={block.url} alt={block.alt} />
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          );
        if (block.type === "gallery")
          return (
            <div className="blog-gallery" key={block.id}>
              {block.images.map((image) => (
                <figure key={image.url}>
                  <img loading="lazy" src={image.url} alt={image.alt} />
                  {image.caption ? (
                    <figcaption>{image.caption}</figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          );
        return (
          <VideoEmbed key={block.id} url={block.url} title={block.title} />
        );
      })}
    </div>
  );
}
