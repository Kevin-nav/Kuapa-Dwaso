"use client";

import { useState } from "react";

export function ShareActions({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState("");
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const share = async () => {
    setShareError("");
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
      setShareError("Could not share automatically. Copy the address bar URL.");
    }
  };
  return (
    <div className="blog-share" aria-label="Share this story">
      <button onClick={() => void share()}>
        {copied ? "Link copied" : "Share"}
      </button>
      <a
        href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
      >
        Facebook
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
      >
        LinkedIn
      </a>
      <a
        href={`https://x.com/intent/post?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
      >
        X
      </a>
      <a href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}>Email</a>
      {shareError ? (
        <span className="blog-share__error" role="status">
          {shareError}
        </span>
      ) : null}
    </div>
  );
}
