/**
 * The verified-profile tick. Shown next to a member's name wherever profiles
 * surface, once an admin has stamped `profiles.photo_verified_at` (the
 * `verified` flag on PublicProfile). Plain SVG, server-component safe.
 */

export function VerifiedTick({ className = "" }: { className?: string }) {
  return (
    <span
      title="Verified profile"
      aria-label="Verified profile"
      className={`inline-grid size-[1.1em] shrink-0 place-items-center rounded-full bg-[color:var(--purple)] align-[-0.12em] ${className}`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="var(--champagne)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[0.65em]"
        aria-hidden="true"
      >
        <path d="M3.5 10.5l4 4 9-9" />
      </svg>
    </span>
  );
}
