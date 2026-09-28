"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { loadLifeQuizSelectionsAction } from "@/app/quiz/life/actions";
import { Icon, Logo } from "@/components/ds";
import { LifeQuizProvider, LifeQuizStep } from "@/components/life-quiz-wizard";
import { ModalShell } from "@/components/modal-shell";

/**
 * The Click quiz as the DS has it: a modal takeover over the page you were on,
 * not a trip to another route (bug board #253, #287). Closing it - X, Escape,
 * the scrim, or Finish - puts you back exactly where you were, so an edit in
 * progress on /profile/edit is still there, unsaved, when it closes.
 *
 * The trigger stays a real link to /quiz/life: that is what a modified click, a
 * new tab or a visitor without JavaScript gets. `data-opens-overlay` tells the
 * edit page's leave-without-saving guard that this link never leaves the page.
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
      {open ? <LifeQuizModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LifeQuizModal({ onClose }: { onClose: () => void }) {
  // The answers the profile already carries, which the quiz opens on - the same
  // read /quiz/life's layout makes. null while it loads. A retake is
  // authoritative within the sections it shows, so the steps only mount once
  // this has landed: on a blank board, Finish would clear answers the member
  // never saw.
  const [initial, setInitial] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let live = true;
    loadLifeQuizSelectionsAction()
      .then((selected) => {
        if (live) setInitial(selected);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <ModalShell
      onClose={onClose}
      label="Click quiz"
      align="sheet"
      /* Its own scroller, and smaller than the shell's p-4 box: body scroll is
         locked, and a card taller than the phone would put Finish out of reach
         (the same reasoning as the booking dialog's card). */
      cardClassName="max-h-[calc(100dvh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-[var(--radius-xl)] bg-[color:var(--champagne)] px-5 pt-4 pb-6 shadow-[var(--shadow-lg)] sm:px-7 sm:pt-6 sm:pb-7"
    >
      <div className="flex items-center justify-between gap-4">
        <Logo size={24} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the quiz"
          className="grid size-11 place-items-center rounded-[12px] text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
        >
          <Icon name="x" size={18} stroke={2.2} />
        </button>
      </div>

      {failed ? (
        <div className="mt-8 text-center">
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
      ) : initial === null ? (
        <p role="status" className="mt-10 mb-6 text-center text-[13.5px] text-[color:var(--slate)]">
          Opening your quiz…
        </p>
      ) : (
        <LifeQuizProvider initialSelected={initial}>
          {/* Keyed by step so each one mounts fresh, as it does on its own route:
              the entrance motion replays and the step records its visit. */}
          <LifeQuizStep
            key={step}
            step={step}
            onStep={setStep}
            onSaved={() => {
              toast.success("Click quiz saved");
              onClose();
            }}
          />
        </LifeQuizProvider>
      )}
    </ModalShell>
  );
}
