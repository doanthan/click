"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMemberAction } from "@/app/admin/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ds";

/**
 * The account-deletion control, on the member's own page rather than in the
 * members table's row menu - a one-way action should cost a deliberate
 * navigation, and the page around it is where an operator can check what they
 * are about to erase.
 *
 * Why this exists at all: the privacy policy invites people to
 * "request deletion of your personal information" at privacy@letsclick.app and
 * there was no way to action one. Account Settings says "coming soon". A
 * request would have arrived by email with nothing on the other end.
 *
 * Two gates, on purpose. Typing the exact address arms the button - it is the
 * only thing standing between an intended deletion and the member above or
 * below on the list. The dialog then takes a reason, which lands in the audit
 * log next to the address, so months later you can still show which request
 * this was.
 */
export function AdminMemberDangerZone({
  profileId,
  email,
  displayName,
  deletedAt,
  upcomingBookings,
}: {
  profileId: string;
  email: string;
  displayName: string;
  deletedAt: string | null;
  /** Confirmed bookings for events that have not happened yet. */
  upcomingBookings: number;
}) {
  const [typed, setTyped] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (deletedAt) {
    return (
      <section className="rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">Account deleted</p>
          <Badge tone="neutral">De-identified</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--slate)]">
          This account was de-identified on{" "}
          {new Intl.DateTimeFormat("en-AU", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date(deletedAt))}
          . Nothing on it identifies a person any more. The bookings and payments below
          are retained because financial records have to be - the audit log holds the
          original address and who actioned the request.
        </p>
      </section>
    );
  }

  const armed = typed.trim().toLowerCase() === email.trim().toLowerCase();

  function remove(reason: string) {
    const form = new FormData();
    form.set("profile_id", profileId);
    form.set("reason", reason);

    startTransition(async () => {
      try {
        await deleteMemberAction(form);
        toast.success("Account deleted. The profile has been de-identified.");
        setTyped("");
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Could not delete the account - nothing was changed.",
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--paper)] p-6">
      <p className="eyebrow">Deletion request</p>
      <h2 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
        Delete this account
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--slate)]">
        For when {displayName} has asked us to delete their personal information. There
        is no undo.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-[12.5px] font-semibold text-[color:var(--ink)]">
            What is erased
          </p>
          <ul className="mt-2 space-y-1 text-[13px] leading-5 text-[color:var(--slate)]">
            <li>Name, email address and sign-in identity</li>
            <li>Photo, gallery, prompts and bio</li>
            <li>Age, birth date, gender and suburb</li>
            <li>Every click, mutual click and plan, torn down</li>
            <li>The address and body of every email we sent them</li>
          </ul>
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[color:var(--ink)]">
            What is kept, and why
          </p>
          <ul className="mt-2 space-y-1 text-[13px] leading-5 text-[color:var(--slate)]">
            <li>Bookings and attendance, so event history stays accurate</li>
            <li>Payments and refunds, which tax law requires us to retain</li>
            <li>The audit log entry naming who actioned the request</li>
          </ul>
        </div>
      </div>

      {upcomingBookings > 0 ? (
        <div className="mt-5 rounded-xl border border-[color:var(--mist)] bg-[color:color-mix(in_srgb,var(--amber)_12%,var(--paper))] p-4">
          <p className="text-[13px] font-semibold leading-5 text-[color:var(--amber-ink)]">
            {upcomingBookings} confirmed {upcomingBookings === 1 ? "booking" : "bookings"} for
            events that have not happened yet.
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[color:var(--slate)]">
            Deleting the account does not cancel a seat or refund anything, and afterwards
            there is no one to email about it. Cancel and refund from Transactions first if
            that is what they want.
          </p>
        </div>
      ) : null}

      <div className="mt-5 max-w-md">
        <label className="grid gap-1.5">
          <span className="text-[12.5px] font-semibold text-[color:var(--ink)]">
            Type <span className="font-mono">{email}</span> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={email}
            className="ck-input w-full"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!armed) {
            toast.error("Type the member's email exactly to confirm.");
            return;
          }
          setConfirming(true);
        }}
        // aria-disabled rather than disabled: a disabled button drops keyboard
        // focus, and the no-op above explains itself instead of going quiet.
        aria-disabled={!armed || isPending || undefined}
        aria-busy={isPending || undefined}
        className={`ck-btn ck-btn--danger ck-btn--md mt-5 ${!armed || isPending ? "opacity-60" : ""}`}
      >
        {isPending ? "Deleting…" : "Delete this account"}
      </button>

      <ConfirmDialog
        open={confirming}
        title={`Delete ${displayName}'s account?`}
        description="Their name, email, photo and every connection go for good. Bookings and payments stay, linked to an anonymous id. This cannot be undone."
        promptLabel="Why (saved to the audit log)"
        promptPlaceholder="e.g. deletion request emailed to privacy@letsclick.app on 25 Aug"
        promptRequired
        confirmLabel="Delete the account"
        tone="rose"
        busy={isPending}
        onConfirm={(reason) => {
          setConfirming(false);
          remove(reason);
        }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
