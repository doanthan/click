"use client";

/**
 * The photo layer of the DS Avatar (ds.tsx). It lives in its own file because
 * hiding a photo that fails to load needs an event handler, and ds.tsx stays
 * free of "use client" so Server Components can render it.
 *
 * A photo that fails hides itself, leaving whatever the caller drew underneath
 * (the Avatar's silhouette, the uploader's initial). alt="" alone is not
 * enough: Firefox still paints a broken image's square frame, which the round
 * crop cuts into four straight lines - every Supabase-hosted photo looked like
 * that while Storage answered 402 (bug board #338, #343).
 */
export function AvatarPhoto({ src, size }: { src: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // A new photo gets a fresh element, so a dead URL's hide never sticks to it.
      key={src}
      // An error that fires before hydration never reaches onError, so look once
      // the element is attached. complete with no pixels means it failed; a
      // lazy photo that has not started loading reports complete=false in
      // Chromium, Firefox and WebKit alike, so it is never hidden early.
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) img.hidden = true;
      }}
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
      src={src}
      alt=""
      width={size}
      height={size}
      // Lazy on purpose: an eager plain <img> inside the route transition holds
      // the page change until it loads (React's suspensey images - see
      // RouteTransition), and a people list is dozens of them.
      loading="lazy"
      decoding="async"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}
