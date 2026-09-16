type PreviewProfileAsset =
  | "farmer"
  | "buyer"
  | "transporter"
  | "transportCollection";

const assetPaths: Record<PreviewProfileAsset, string> = {
  farmer: "preview/profiles/farmer-ama-mensah.webp",
  buyer: "preview/profiles/buyer-adwoa-owusu.webp",
  transporter: "preview/profiles/transporter-kwame-asare.webp",
  transportCollection: "preview/profiles/transport-maize-collection.webp",
};

function getPreviewAssetUrl(asset: PreviewProfileAsset) {
  const baseUrl =
    process.env.NEXT_PUBLIC_PREVIEW_PROFILE_ASSET_BASE_URL?.replace(/\/+$/, "");
  const path = assetPaths[asset];

  return baseUrl === undefined || baseUrl.length === 0
    ? `/${path}`
    : `${baseUrl}/${path}`;
}

export function PreviewProfileImage({
  asset,
  alt,
  className,
  eager = false,
}: {
  asset: PreviewProfileAsset;
  alt: string;
  className: string;
  eager?: boolean;
}) {
  return (
    // A plain image supports a configurable R2 hostname without weakening Next's
    // remote image allowlist. Files are pre-sized WebP assets.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getPreviewAssetUrl(asset)}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
    />
  );
}
