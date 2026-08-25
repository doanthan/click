"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSystemSettingsAction } from "@/app/admin/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ds";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import type { SystemSettings } from "@/lib/event-repository";

/**
 * Read one numeric setting, reporting WHY it is unusable instead of coercing.
 *
 * The fields are held as strings on purpose. They used to be numbers fed by
 * `Number(e.target.value)`, and Number("") is 0 - so an operator who cleared
 * the commission box to retype it, then saved, shipped 0 bps to live Stripe
 * pricing with no warning. A blank box now means "invalid", never "zero".
 */
function bounded(
  raw: string,
  min: number,
  max: number,
  fallback: number,
): { value: number; error: string | null } {
  if (raw.trim() === "") {
    return { value: fallback, error: "Enter a number - an empty box is not the same as 0." };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return { value: fallback, error: "That is not a number." };
  if (parsed < min || parsed > max) {
    return { value: fallback, error: `Must be between ${min} and ${max}.` };
  }
  return { value: parsed, error: null };
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <span role="alert" className="text-[12.5px] font-medium text-[color:var(--danger)]">
      {message}
    </span>
  );
}

function UnsavedMark({ show }: { show: boolean }) {
  if (!show) return null;
  return <Badge tone="amber">Unsaved</Badge>;
}

export function AdminSystemSettings({ initial }: { initial: SystemSettings }) {
  const [maintenance, setMaintenance] = useState(initial.maintenanceMode);
  const [matchingV2, setMatchingV2] = useState(initial.matchingV2Enabled);
  const [commission, setCommission] = useState(String(initial.commissionRateBps));
  const [bookingFeePercent, setBookingFeePercent] = useState(String(initial.bookingFeeBps / 100));
  const [banner, setBanner] = useState(initial.marketingBanner);
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  // PLATFORM_FEE_BPS wins over the stored rate, and release-check.mjs requires
  // that variable for a production release - so on a real deployment this box
  // is always read-only. It used to accept edits, save them, and change nothing
  // about what Stripe charged.
  const commissionLocked = initial.commissionRateSource === "env";

  const commissionField = bounded(commission, 0, 5000, initial.commissionRateBps);
  const bookingField = bounded(bookingFeePercent, 0, 50, initial.bookingFeeBps / 100);
  const commissionBps = Math.round(commissionField.value);
  const bookingBps = Math.round(bookingField.value * 100);

  // Per-section dirty flags. An unusable field counts as dirty so the guard
  // still fires - the operator has changed something, it just cannot be saved.
  const maintenanceDirty = maintenance !== initial.maintenanceMode;
  const matchingV2Dirty = matchingV2 !== initial.matchingV2Enabled;
  const commissionDirty =
    !commissionLocked &&
    (commissionField.error !== null || commissionBps !== initial.commissionRateBps);
  const bookingDirty = bookingField.error !== null || bookingBps !== initial.bookingFeeBps;
  const bannerDirty = banner !== initial.marketingBanner;

  const hasError = (!commissionLocked && commissionField.error !== null) || bookingField.error !== null;
  const dirty =
    maintenanceDirty || matchingV2Dirty || commissionDirty || bookingDirty || bannerDirty;

  // Link interception only - never gates the save itself. After a successful
  // save the server action revalidates /admin/system, `initial` comes back with
  // the new values, and `dirty` falls to false on its own.
  const { pendingHref, confirm: leave, cancel: stay } = useUnsavedGuard(dirty);

  function save() {
    const form = new FormData();
    if (maintenance) form.set("maintenance_mode", "on");
    if (matchingV2) form.set("matching_v2_enabled", "on");
    // Deliberately absent when the environment owns the rate: sending it would
    // make the server throw on a value the operator never chose to change.
    if (!commissionLocked) form.set("commission_rate_bps", String(commissionBps));
    form.set("booking_fee_bps", String(bookingBps));
    form.set("marketing_banner", banner);

    startTransition(async () => {
      try {
        await updateSystemSettingsAction(form);
        toast.success("System settings saved.");
      } catch {
        toast.error("Could not save settings - nothing was changed.");
      }
    });
  }

  function requestSave() {
    if (isPending) return;
    if (hasError) {
      toast.error("Fix the highlighted field before saving.");
      return;
    }
    if (!dirty) return;
    // Maintenance mode takes the whole site offline for every visitor, and it
    // rides the same Save as a banner typo fix. Gate ONLY that change - the
    // common fee/banner edit stays a single tap.
    if (maintenanceDirty) {
      setConfirming(true);
      return;
    }
    save();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Maintenance mode</p>
            <h3 className="font-display mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
              Take Click offline.
              <UnsavedMark show={maintenanceDirty} />
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
              When on, every visitor gets a full-screen &ldquo;back shortly&rdquo; screen
              instead of the app. Admin, sign-in and sign-out stay reachable, and you
              keep seeing the real site with a strip at the top reminding you it is on.
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
              It is a notice, not a lock: pages still render behind it and the API is
              untouched, so a checkout already in flight will still complete. Use it to
              stop people starting things, not to make writes impossible.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-2">
            <input
              type="checkbox"
              checked={maintenance}
              onChange={(e) => setMaintenance(e.target.checked)}
              className="size-5 accent-[color:var(--purple)]"
            />
            <span className="text-[12.5px] font-semibold text-[color:var(--ink)]">
              {maintenance ? "On" : "Off"}
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <p className="eyebrow">Commission rate</p>
        <h3 className="font-display mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
          Per paid-ticket fee
          <UnsavedMark show={commissionDirty} />
        </h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          Stored in basis points. 290 bps = 2.9%. Taken off each merchant-hosted paid
          booking as the Stripe application fee.
        </p>

        {commissionLocked ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="font-display text-3xl font-semibold tabular-nums leading-none text-[color:var(--ink)]">
                {(initial.commissionRateBps / 100).toFixed(2)}%
              </p>
              <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
                {initial.commissionRateBps} bps
              </span>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[color:var(--slate)]">
              Set by the{" "}
              <span className="font-mono text-[12.5px] text-[color:var(--ink)]">
                PLATFORM_FEE_BPS
              </span>{" "}
              environment variable, which takes precedence over anything stored here. Change
              it where the deployment&rsquo;s environment is configured and redeploy - an edit on
              this page would save and have no effect on what Stripe charges, so the box is
              not offered.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* The visible heading names the setting; the label below is what
                carries that name to assistive tech, which previously announced
                this live-pricing box as an unlabelled spin button. */}
            <label className="grid gap-1.5">
              <span className="sr-only">Commission rate in basis points</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={5000}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                aria-invalid={commissionField.error ? true : undefined}
                className={`ck-input w-28 ${commissionField.error ? "ck-input--invalid" : ""}`}
              />
            </label>
            <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
              bps · {(commissionBps / 100).toFixed(2)}%
            </span>
            <FieldError message={commissionField.error} />
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Matching engine</p>
            <h3 className="font-display mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
              Rank with v2
              <UnsavedMark show={matchingV2Dirty} />
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
              {matchingV2
                ? "On. Discovery and the people surfaces rank with the cohort-aware v2 model, and the v1 sliders on Matching Formula have no effect while this is on."
                : "Off. Discovery falls back to the v1 scorer, which is what the weights on Matching Formula tune."}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
              This switch used to live only on the internal inspector at /algo, which returns
              404 on a production deployment - so on the live site there was no way to turn v2
              off at all.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-2">
            <input
              type="checkbox"
              checked={matchingV2}
              onChange={(e) => setMatchingV2(e.target.checked)}
              className="size-5 accent-[color:var(--purple)]"
            />
            <span className="text-[12.5px] font-semibold text-[color:var(--ink)]">
              {matchingV2 ? "On" : "Off"}
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <p className="eyebrow">Booking fees %</p>
        <h3 className="font-display mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
          Per-booking service fee
          <UnsavedMark show={bookingDirty} />
        </h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          Added on top of the ticket price at checkout. Set as a percentage of the
          order subtotal. 0% disables the fee.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="grid gap-1.5">
            <span className="sr-only">Booking fee as a percentage of the order subtotal</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={50}
              step={0.1}
              value={bookingFeePercent}
              onChange={(e) => setBookingFeePercent(e.target.value)}
              aria-invalid={bookingField.error ? true : undefined}
              className={`ck-input w-28 ${bookingField.error ? "ck-input--invalid" : ""}`}
            />
          </label>
          <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
            % · {bookingBps} bps
          </span>
          <FieldError message={bookingField.error} />
        </div>
      </section>

      <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <p className="eyebrow">Marketing banner</p>
        <h3 className="font-display mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
          Site-wide message
          <UnsavedMark show={bannerDirty} />
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
          Shown as a strip above the header on every page while it is non-empty, signed
          in or not. Each visitor can dismiss it, and editing the text brings it back for
          everyone who did. 200 characters max; clear the box to remove it.
        </p>
        <label className="mt-4 grid gap-1.5">
          <span className="sr-only">Site-wide marketing banner message</span>
          <input
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            maxLength={200}
            placeholder="e.g. New events drop every Sunday. Tap the bell to follow."
            className="ck-input w-full"
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!dirty && !isPending ? (
          <p className="text-[12.5px] font-medium text-[color:var(--slate)]">
            Nothing to save - these are the live settings.
          </p>
        ) : null}
        <button
          type="button"
          onClick={requestSave}
          // aria-disabled rather than disabled: a disabled button drops focus
          // and dumps keyboard users at the top of the page mid-write. The
          // no-op lives in requestSave, which also explains an invalid field.
          // An unusable field always counts as dirty, so `!dirty` already
          // implies "nothing to save AND nothing to fix".
          aria-disabled={isPending || !dirty || undefined}
          aria-busy={isPending || undefined}
          className={`ck-btn ck-btn--primary ck-btn--md ${isPending || !dirty ? "opacity-60" : ""}`}
        >
          {isPending ? "Saving…" : "Save system settings"}
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={maintenance ? "Take Click offline?" : "Bring Click back online?"}
        description={
          maintenance
            ? "Every visitor gets the maintenance banner until this is switched off again. Admin stays reachable. Any other edits above save at the same time."
            : "Public and protected routes start serving normally again. Any other edits above save at the same time."
        }
        confirmLabel={maintenance ? "Take Click offline" : "Bring Click online"}
        tone={maintenance ? "rose" : "peach"}
        busy={isPending}
        onConfirm={() => {
          setConfirming(false);
          save();
        }}
        onCancel={() => setConfirming(false)}
      />

      <ConfirmDialog
        open={pendingHref !== null}
        title="Leave without saving?"
        description="The settings you changed here have not been written yet."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        tone="rose"
        onConfirm={leave}
        onCancel={stay}
      />
    </div>
  );
}
