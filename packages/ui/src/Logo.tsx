import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="22" cy="30" r="6" fill="#2d8a4e" opacity="0.5" />
      <circle cx="18" cy="60" r="6" fill="#2d8a4e" opacity="0.65" />
      <circle cx="22" cy="90" r="6" fill="#2d8a4e" opacity="0.8" />
      <circle cx="48" cy="45" r="8" fill="#2d8a4e" opacity="0.85" />
      <circle cx="48" cy="75" r="8" fill="#2d8a4e" opacity="0.9" />
      <circle cx="88" cy="60" r="22" fill="#2d8a4e" />
    </svg>
  );
}
