import type { ReactNode } from "react";

/**
 * The "who's going" heartbeat — a row of up to three real attendee avatars
 * with a count label. Extracted verbatim from the markup that used to live
 * inline in EventCard so the same honest social-proof primitive can be reused
 * on the homepage hero panel and the group cards.
 *
 * Honest by construction: it only renders the avatars it is actually given
 * (never pads to three with placeholders) and the caller owns the visibility
 * gate (EventCard still only mounts it when count > 2 AND avatars exist), so no
 * surface can imply more faces than really exist.
 */
export function FaceStack({
  avatars,
  count,
  label,
  className = "",
  ringClass = "border-[color:var(--champagne)]",
}: {
  avatars: string[];
  count: number;
  /** Overrides the default `${count} going` label. */
  label?: ReactNode;
  className?: string;
  /** Border colour of the avatar rings — match it to the surface behind them. */
  ringClass?: string;
}) {
  const shown = avatars.slice(0, 3);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {shown.length > 0 ? (
        <div className="flex -space-x-2">
          {shown.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${url}-${i}`}
              src={url}
              alt=""
              className={`h-7 w-7 rounded-full border-2 ${ringClass} object-cover hard-shadow-sm`}
            />
          ))}
        </div>
      ) : null}
      <span className="text-xs font-bold text-[color:var(--mauve)]">
        {label ?? `${count} going`}
      </span>
    </div>
  );
}
