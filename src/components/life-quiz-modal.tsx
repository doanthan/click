"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadClickQuizAction } from "@/app/quiz/life/actions";
import { ClickQuiz } from "@/components/click-quiz";
import { Icon } from "@/components/ds";
import { ModalShell } from "@/components/modal-shell";
import { Skeleton } from "@/components/skeleton";
import type { ClickQuizState } from "@/lib/click-quiz";

/**
 * The Click quiz as the DS has it: a modal over the page you were on, not a
 * trip to another route (bug board #253, #287). Closing it - X, Escape, the
 * scrim, Maybe later - puts you back exactly where you were, so an edit in
 * progress on /profile/edit is still there, unsaved, when it closes.
 *
 * The trigger stays a real link to /quiz/life: that is what a modified click, a
 * new tab or a visitor without JavaScript gets. `data-opens-overlay` tells the
 * edit page's leave-without-saving guard that this link never leaves the page.
 * (The name predates the Click quiz replacing the Life quiz; every entry point
 * imports it, so it kept its name.)
 */
export function LifeQuizModalLink({
  href = "/quiz/life",
  className,
  children,
}: {
  /** The fallback route - only ever followed without JS or on a modified click. */
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Link
        href={href}
        data-opens-overlay=""
        aria-haspopup="dialog"
        className={className}
        onClick={(event) => {
          // A modified click means "open it somewhere else" - the link does that.
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
          }
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </Link>
      {/* A sibling of the link, never inside it: the modal is portalled, but a
          React event still bubbles through the tree, and a tap in the quiz must
          not reach the link's onClick. */}
      {open ? <ClickQuizModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ClickQuizModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  // The answers the quiz opens on. null while they load: Finish is
  // authoritative over every quiz life tag, so the steps only mount once the
  // member's own answers are on them.
  const [initial, setInitial] = useState<ClickQuizState | null>(null);
  const [failed, setFailed] = useState(false);
  // A save changes what the page underneath shows (the setup checklist, the
  // quiz row), so closing after one refreshes it. Not at each save: on
  // /dashboard the quiz row this modal hangs off disappears the moment the quiz
  // counts as done, and would take the finish screen with it.
  const saved = useRef(false);

  useEffect(() => {
    let live = true;
    loadClickQuizAction()
      .then((state) => {
        if (live) setInitial(state);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  function close() {
    if (saved.current) router.refresh();
    onClose();
  }

  const closeButton = (
    <button
      type="button"
      onClick={close}
      aria-label="Close the quiz"
      className="grid size-11 place-items-center rounded-[12px] text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
    >
      <Icon name="x" size={18} stroke={2.2} />
    </button>
  );

  return (
    <ModalShell
      onClose={close}
      label="The Click quiz"
      align="sheet"
      /* A white card (spec rev 1 Jul: matches the Profile and RSVP modals).
         The quiz lays itself out as a column with its own scroller between a
         fixed top bar and footer: body scroll is locked, and a step taller
         than the phone would otherwise put Next out of reach. */
      cardClassName="w-full max-w-[560px] overflow-hidden rounded-[var(--radius-xl)] bg-[color:var(--paper)] shadow-[var(--shadow-lg)]"
    >
      {initial ? (
        <ClickQuiz
          initial={initial}
          mode="modal"
          onClose={close}
          onSaved={() => {
            saved.current = true;
          }}
        />
      ) : (
        <div className="px-5 pt-3 pb-8 sm:px-7 sm:pt-4">
          <div className="flex justify-end">{closeButton}</div>
          {failed ? (
            <div className="mt-4 text-center">
              <p className="text-[14px] leading-[1.55] text-[color:var(--slate)]">
                We couldn&apos;t open the quiz here just now.
              </p>
              <Link
                href="/quiz/life"
                className="font-display mt-3 inline-flex text-[14px] font-semibold text-[color:var(--purple)] underline underline-offset-2"
              >
                Take it on its own page
              </Link>
            </div>
          ) : (
            // Calm skeleton in the quiz's own shapes - glyph, title, pills.
            <div role="status" aria-label="Opening the Click quiz" className="mt-1">
              <Skeleton className="mx-auto size-11 rounded-full" />
              <Skeleton className="mx-auto mt-4 h-6 w-56" />
              <Skeleton className="mx-auto mt-3 h-4 w-72 max-w-full" />
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {[124, 88, 132, 104, 148].map((width) => (
                  <Skeleton key={width} className="h-11 rounded-[12px]" style={{ width }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
