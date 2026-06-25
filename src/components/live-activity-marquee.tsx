/**
 * Live-activity marquee — a slow, honest ticker that sits directly under the
 * hero and makes the city feel awake. Every item is derived server-side from
 * the real events array (events this week, people going, the next event, host
 * and suburb counts), so there is nothing invented and nothing about private
 * Clicks here.
 *
 * Server component on purpose: the scroll, the pause-on-hover, and the
 * reduced-motion freeze are all handled by the .marquee / .marquee__track CSS
 * in globals.css, so no client JS is needed. Renders nothing when there is no
 * activity to report.
 */
export function LiveActivityMarquee({ items }: { items: string[] }) {
  if (!items.length) return null;

  return (
    <section
      aria-label="What is happening on Click right now"
      className="border-y border-[color:var(--line)] bg-[color:var(--cream)] py-3.5"
    >
      <div className="marquee">
        {/* The track is duplicated so the -100% loop hands off seamlessly. The
            second copy is decorative, hidden from assistive tech. */}
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="marquee__track items-center"
            aria-hidden={copy === 1 ? true : undefined}
          >
            {items.map((item, i) => (
              <span
                key={`${copy}-${i}`}
                className="inline-flex items-center gap-2.5 whitespace-nowrap text-sm font-semibold text-[color:var(--ink)]"
              >
                <span className="text-[color:var(--coral)]" aria-hidden>
                  ✦
                </span>
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
