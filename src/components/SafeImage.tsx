"use client";

import Image from "next/image";
import { useState } from "react";

import { IBox } from "./icons";

/**
 * `next/image` throws during render on a src it cannot parse, which turns one
 * bad catalog row into a 500 for the whole page. Catalog image URLs are typed
 * by hand into the ERP, so malformed ones are expected rather than exceptional.
 */
export function isRenderableImageUrl(src: string | null | undefined): src is string {
  if (!src?.trim()) return false;
  try {
    const { protocol } = new URL(src);
    return protocol === "https:" || protocol === "http:";
  } catch {
    // Relative paths are made absolute server-side, so anything still relative
    // here is malformed.
    return false;
  }
}

/**
 * An optimised image that degrades instead of breaking. If the optimizer
 * cannot fetch the source (some hosts refuse server-side requests), the
 * browser loads it directly, as the single-page build did; only if that fails
 * too does the box placeholder appear.
 */
export function SafeImage({
  src,
  alt,
  sizes,
  width,
  height,
  eager = false,
  className,
  fallbackSize = 40,
  onFail,
}: {
  src: string | null | undefined;
  alt: string;
  /** Required with `fill` (the default, when no width/height is given). */
  sizes?: string;
  width?: number;
  height?: number;
  /** Above-the-fold images load at once instead of lazily. */
  eager?: boolean;
  className?: string;
  fallbackSize?: number;
  /** Called once the image has failed for good and the placeholder shows. */
  onFail?: () => void;
}) {
  // Keyed by src so a new image starts over without an effect.
  const [failure, setFailure] = useState<{ src: string; level: number } | null>(null);
  const level = failure && failure.src === src ? failure.level : 0;

  if (!isRenderableImageUrl(src) || level >= 2) {
    return (
      <span className="image-fallback">
        <IBox s={fallbackSize} />
        <span className="sr-only">Rasm mavjud emas</span>
      </span>
    );
  }

  const sized = width != null && height != null;
  return (
    <Image
      key={level}
      src={src}
      alt={alt}
      className={className}
      {...(sized ? { width, height } : { fill: true, sizes: sizes ?? "100vw" })}
      loading={eager ? "eager" : "lazy"}
      unoptimized={level === 1}
      onError={() => {
        setFailure({ src, level: level + 1 });
        if (level + 1 >= 2) onFail?.();
      }}
    />
  );
}
