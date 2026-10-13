"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { requestInvite, type InviteRequestState } from "@/app/waitlist/actions";
import { Button, FormField, Icon } from "./ds";
import { SubmitButton, useSavedFlash } from "./ds-client";

const IDLE: InviteRequestState = { status: "idle" };

const QUIET_LINK =
  "ck-taplink font-display inline-flex items-center gap-1.5 border-b border-[color:var(--lavender-300)] pb-0.5 text-[14.5px] font-medium text-[color:var(--purple)] transition-colors hover:border-[color:var(--purple)]";

/**
 * The action column of /waitlist (Landing canon, STATE A): ONE "Request an
 * invite" button that opens a two-field form - email + suburb/postcode, nothing
 * else - then the success screen with the person's share link.
 */
export function WaitlistForm({ refCode }: { refCode: string | null }) {
  const [state, formAction] = useActionState(requestInvite, IDLE);
  const [open, setOpen] = useState(false);

  if (state.status === "done") {
    return <InviteRequested area={state.area} shareUrl={state.shareUrl} />;
  }

  const values = state.status === "error" ? state.values : { email: "", place: "" };
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <div className="max-w-[420px]">
      {/* An error can only come back from a submit, so the form stays open for it. */}
      {open || state.status === "error" ? (
        <form action={formAction} noValidate className="rise-soft grid gap-3.5">
          <input type="hidden" name="ref" value={refCode ?? ""} />
          {/* Bot trap: off-screen, out of the tab order and the accessibility
              tree. A person never fills it; requestInvite drops any request
              that does, without saying so. */}
          <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label>
              Leave this empty
              <input type="text" name="leave_blank" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>
          <FormField
            id="waitlist-email"
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            defaultValue={values.email}
            error={errors.email}
            autoFocus
          />
          <FormField
            id="waitlist-place"
            label="Suburb or postcode"
            name="place"
            autoComplete="postal-code"
            placeholder="Newtown, or 2042"
            maxLength={80}
            defaultValue={values.place}
            error={errors.place}
          />
          {state.status === "error" && state.message ? (
            <p role="alert" className="text-[13.5px] font-medium text-[color:var(--danger)]">
              {state.message}
            </p>
          ) : null}
          <SubmitButton size="lg" full pendingLabel="Requesting..." className="mt-1">
            Request an invite
          </SubmitButton>
        </form>
      ) : (
        <Button size="lg" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
          Request an invite
        </Button>
      )}

      <p className="mt-5 text-[15px] leading-[1.6] text-[color:var(--slate)]">
        <strong className="font-semibold text-[color:var(--ink)]">Invite-only.</strong> Launching
        first in Sydney&apos;s inner west and inner east - Newtown, Surry Hills and around.
      </p>
      <p className="mt-2 text-[15px] leading-[1.6] text-[color:var(--slate)]">
        Somewhere else in Sydney? Join anyway - we&apos;ll tell you the moment Click reaches you.
      </p>
      <p className="mt-6">
        <Link href="/how-it-works" className={QUIET_LINK}>
          How clicking works <Icon name="arrowR" size={15} stroke={2} />
        </Link>
      </p>
    </div>
  );
}

// Touch devices get the native share sheet (it carries Copy as well); a mouse
// gets a plain copy. Read once on the client - the server renders "Copy link".
const noSubscribe = () => () => {};
function canShareNatively() {
  return typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
}

function InviteRequested({ area, shareUrl }: { area: string; shareUrl: string }) {
  const nativeShare = useSyncExternalStore(noSubscribe, canShareNatively, () => false);
  const { flashed, flash, hold } = useSavedFlash<"copied" | "failed">(2400);
  const shownUrl = shareUrl.replace(/^https?:\/\/(www\.)?/, "");
  // The form that had focus is gone; land keyboard and screen-reader users on
  // the outcome rather than at the top of the document.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  async function shareLink() {
    if (nativeShare) {
      try {
        await navigator.share({ title: "Click", text: "I've requested an invite to Click. Want in too?", url: shareUrl });
      } catch {
        // Dismissing the sheet rejects too; nothing to tell anyone.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      flash("copied");
    } catch {
      // Held, not flashed: the fallback has to stay readable.
      hold("failed");
    }
  }

  return (
    <div className="rise-soft max-w-[440px]">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sage)_16%,white)] text-[color:var(--sage-ink)]"
      >
        <Icon name="check" size={24} stroke={2.4} />
      </span>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display mt-4 text-[length:var(--text-h2)] leading-tight font-semibold tracking-[-0.015em] text-[color:var(--ink)] outline-none"
      >
        You&apos;re on the list.
      </h2>
      <p className="mt-2 text-base leading-[1.6] text-[color:var(--slate)]">
        {area === "pilot"
          ? "We'll be in touch when your suburb opens."
          : "We'll tell you the moment Click reaches you."}{" "}
        No rush - good things are worth showing up for.
      </p>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[color:var(--mist)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <p className="eyebrow">Want in sooner?</p>
        <p className="mt-2.5 text-[15.5px] leading-[1.6] text-[color:var(--ink)]">
          Invite friends - every one moves you up.{" "}
          <strong className="font-semibold">Three guarantees you a spot in the first round.</strong>
        </p>
        {/* Stacked on a phone, where beside the button the link would
            truncate away the very code that makes it yours. */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <span
            className="min-w-0 flex-1 truncate rounded-[var(--radius-md)] border border-[color:var(--mist)] bg-[color:var(--champagne)] px-3.5 py-2.5 font-mono text-[14px] leading-6 text-[color:var(--ink)] select-all"
            title={shareUrl}
          >
            {shownUrl}
          </span>
          <Button onClick={shareLink} className="sm:flex-none">
            {flashed === "copied" ? (
              <>
                <Icon name="check" size={16} stroke={2.4} /> Copied
              </>
            ) : nativeShare ? (
              <>
                <Icon name="share" size={16} /> Share link
              </>
            ) : (
              "Copy link"
            )}
          </Button>
        </div>
        {/* The button already says "Copied" on screen; this says it aloud. */}
        <p aria-live="polite" className="sr-only">
          {flashed === "copied" ? "Link copied." : ""}
        </p>
        {flashed === "failed" ? (
          <p role="alert" className="mt-2.5 text-[13px] text-[color:var(--slate)]">
            Couldn&apos;t copy it here - tap the link to select it, then copy.
          </p>
        ) : null}
      </div>

      <p className="mt-5">
        <Link href="/how-it-works" className={QUIET_LINK}>
          How clicking works <Icon name="arrowR" size={15} stroke={2} />
        </Link>
      </p>
    </div>
  );
}
