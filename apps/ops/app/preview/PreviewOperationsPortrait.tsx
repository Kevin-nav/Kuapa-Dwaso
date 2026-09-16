const operationsPortraitPath =
  "preview/profiles/operations-akosua-boateng.webp";

function getOperationsPortraitUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_PREVIEW_PROFILE_ASSET_BASE_URL?.replace(/\/+$/, "");

  return baseUrl === undefined || baseUrl.length === 0
    ? `/${operationsPortraitPath}`
    : `${baseUrl}/${operationsPortraitPath}`;
}

export function PreviewOperationsPortrait({
  className,
}: {
  className: string;
}) {
  return (
    // A plain image supports a configurable R2 hostname without weakening Next's
    // remote image allowlist. The local fallback is a pre-sized WebP asset.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getOperationsPortraitUrl()}
      alt="Akosua Boateng"
      className={className}
      loading="eager"
      decoding="async"
      fetchPriority="high"
    />
  );
}
