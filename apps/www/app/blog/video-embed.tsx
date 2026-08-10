"use client";

import { useState } from "react";

function embedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be"))
      return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (url.hostname.includes("youtube.com"))
      return `https://www.youtube-nocookie.com/embed/${url.searchParams.get("v") ?? ""}`;
    if (url.hostname.includes("vimeo.com"))
      return `https://player.vimeo.com/video/${url.pathname.split("/").filter(Boolean).at(-1) ?? ""}`;
  } catch {
    return null;
  }
  return null;
}

export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const [active, setActive] = useState(false);
  const src = embedUrl(url);
  if (!src)
    return (
      <a
        className="blog-video-link"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        Watch: {title}
      </a>
    );
  return (
    <div className="blog-video">
      {active ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setActive(true)}>
          <span>Play video</span>
          <strong>{title}</strong>
        </button>
      )}
    </div>
  );
}
