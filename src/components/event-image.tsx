"use client";

import Image, { type ImageProps } from "next/image";
import { useMemo, useState } from "react";
import { resolveEventImage } from "@/lib/event-images";

type EventImageProps = Omit<ImageProps, "src"> & {
  src?: string | null;
  category?: string | null;
};

/**
 * Event artwork with two layers of resilience:
 * - known-dead storage hosts are replaced before the first request;
 * - a runtime 4xx/5xx or malformed future upload swaps to the same local image.
 */
export function EventImage({ src, category, alt, onError, ...props }: EventImageProps) {
  const fallbackSrc = useMemo(() => resolveEventImage(null, category), [category]);
  const preferredSrc = useMemo(() => resolveEventImage(src, category), [src, category]);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const currentSrc = failedSrc === preferredSrc ? fallbackSrc : preferredSrc;

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      onError={(event) => {
        onError?.(event);
        if (currentSrc !== fallbackSrc) setFailedSrc(preferredSrc);
      }}
    />
  );
}
