"use client";

import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ds";

/**
 * The settings sub-nav plus its panel column.
 *
 * All five panels are rendered ONCE, on the server, from the one settings
 * object the page already loaded, and handed down here as ReactNodes. Data
 * loading stays server-side - the only thing that moved to the client is the
 * choice of which already-rendered panel is on screen. The old rail was five
 * `<Link href="?tab=…">`s, so every tap paid a full server round-trip (auth +
 * getOwnProfile) to re-derive panels from a settings object that had not
 * changed.
 *
 * The URL still tracks the tab, so a tab stays linkable and Back/Forward still
 * work:
 *
 * - window.history.pushState is the App Router's supported shallow-routing
 *   escape hatch. Next patches the native history methods, so the address bar
 *   and the router's own view of the URL move together and no RSC refetch
 *   fires.
 * - Back/Forward moves the address bar on its own, so the popstate listener is
 *   what makes the panel follow it instead of going quietly out of sync.
 *
 * The rail is real `<a href>` markup and only the plain left-click is
 * swallowed, so cmd/middle-click still opens the tab in a new browser tab and a
 * no-JS load still lands on the right panel via the server's ?tab= read.
 */
export function SettingsTabs<K extends string>({
  tabs,
  initialTab,
  panels,
}: {
  tabs: readonly { key: K; label: string; icon: IconName }[];
  /** Resolved server-side from ?tab=, so first paint already shows this panel. */
  initialTab: K;
  panels: Record<K, ReactNode>;
}) {
  const [tab, setTab] = useState<K>(initialTab);

  useEffect(() => {
    // The tab lives entirely in ?tab=, so re-reading the location IS the whole
    // history restore. An absent or unknown value falls back to the tab the
    // server resolved, which is the same "unknown tab -> Account" rule.
    function sync() {
      const wanted = new URLSearchParams(window.location.search).get("tab");
      const found = tabs.find((t) => t.key === wanted);
      setTab(found ? found.key : initialTab);
    }
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [tabs, initialTab]);

  const select = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, key: K) => {
      // Anything that is not an ordinary left-click belongs to the browser -
      // cmd/ctrl opens a new tab, shift a new window, alt downloads. Hijacking
      // those would quietly break every one of them.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      // Re-tapping the current tab is a no-op rather than a duplicate history
      // entry the user would have to press Back through twice.
      if (key === tab) return;
      setTab(key);
      window.history.pushState(null, "", `?tab=${key}`);
    },
    [tab],
  );

  const label = tabs.find((t) => t.key === tab)?.label ?? "Settings";

  return (
    <div className="mt-6 grid items-start gap-8 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-11">
      {/* Sub-nav: a sticky column on desktop, a scrollable rail on mobile. */}
      <nav className="ckRail -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <a
              key={t.key}
              href={`/account-settings?tab=${t.key}`}
              onClick={(event) => select(event, t.key)}
              aria-current={on ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[12px] px-3.5 py-2.5 text-[14.5px] transition-colors ${
                on
                  ? "bg-[color:var(--lavender-100)] font-semibold text-[color:var(--purple-800)]"
                  : "font-medium text-[color:var(--ink-soft)] hover:bg-[color:var(--lavender-100)]"
              }`}
            >
              <Icon
                name={t.icon}
                size={18}
                className={on ? "text-[color:var(--purple)]" : "text-[color:var(--slate)]"}
              />
              {t.label}
            </a>
          );
        })}
      </nav>

      {/* Narrow content column: capped, left-aligned, whitespace to the right. */}
      <div className="min-w-0 max-w-[640px]">
        {/* The heading carries no state, so keying it on the tab is free and
            gives the swap its 240ms rise - without it the column replaces
            itself in one hard cut that reads as "did that do anything?".
            Resting state is fully visible; the rise is purely additive. */}
        <div key={tab} className="rise-soft">
          <h2 className="font-display text-[length:var(--text-h2)] font-semibold leading-tight tracking-[-0.01em]">
            {label}
          </h2>
          <div className="mt-4 h-px bg-[color:var(--mist)]" />
        </div>

        {/* All five panels stay MOUNTED and the inactive ones are `hidden`,
            rather than rendering only `panels[tab]`.

            That is not a micro-optimisation, it is the correctness half of
            making the swap local: the toggles inside these panels are
            optimistic, and their `on` lives in component state seeded from the
            server payload of the ORIGINAL load. Unmounting a panel on the way
            to another tab and rebuilding it on the way back would re-seed every
            switch from that stale payload - a user who turned Weekly digest on,
            looked at Privacy and came back would find it showing off while the
            database said on. There is no refetch here to correct it any more.

            `hidden` is display:none, so the inactive panels are out of the tab
            order and out of the accessibility tree - and a CSS animation is
            cancelled while an element is display:none and starts afresh when it
            is shown, so each panel still rises as it comes in. */}
        {tabs.map((t) => (
          <div key={t.key} className="rise-soft" hidden={t.key !== tab}>
            {panels[t.key]}
          </div>
        ))}
      </div>
    </div>
  );
}
