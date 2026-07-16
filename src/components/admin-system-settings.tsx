"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSystemSettingsAction } from "@/app/admin/actions";
import type { SystemSettings } from "@/lib/event-repository";

export function AdminSystemSettings({ initial }: { initial: SystemSettings }) {
  const [maintenance, setMaintenance] = useState(initial.maintenanceMode);
  const [commission, setCommission] = useState(initial.commissionRateBps);
  const [bookingFeePercent, setBookingFeePercent] = useState(
    initial.bookingFeeBps / 100,
  );
  const [banner, setBanner] = useState(initial.marketingBanner);
  const [isPending, startTransition] = useTransition();

  function save() {
    const form = new FormData();
    if (maintenance) form.set("maintenance_mode", "on");
    form.set("commission_rate_bps", String(commission));
    form.set("booking_fee_bps", String(Math.round(bookingFeePercent * 100)));
    form.set("marketing_banner", banner);

    startTransition(async () => {
      try {
        await updateSystemSettingsAction(form);
        toast.success("System settings saved.");
      } catch {
        toast.error("Could not save settings.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Maintenance mode</p>
            <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
              Take Click offline.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
              When on, public + protected routes can render a maintenance
              banner. Admin remains accessible.
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
        <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
          Per paid-ticket fee
        </h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          Stored in basis points. 290 bps = 2.9%. Applied at checkout for Click-managed paid events.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={5000}
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
            className="w-28 rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
          />
          <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
            bps · {(commission / 100).toFixed(2)}%
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <p className="eyebrow">Booking fees %</p>
        <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
          Per-booking service fee
        </h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          Added on top of the ticket price at checkout. Set as a percentage of the
          order subtotal. 0% disables the fee.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={50}
            step={0.1}
            value={bookingFeePercent}
            onChange={(e) => setBookingFeePercent(Number(e.target.value))}
            className="w-28 rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
          />
          <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
            % · {Math.round(bookingFeePercent * 100)} bps
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <p className="eyebrow">Marketing banner</p>
        <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
          Site-wide message
        </h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          Shown on home + protected pages when non-empty. 200 chars max.
        </p>
        <input
          value={banner}
          onChange={(e) => setBanner(e.target.value)}
          maxLength={200}
          placeholder="e.g. New events drop every Sunday. Tap the bell to follow."
          className="mt-4 w-full rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
        />
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="ck-btn ck-btn--primary ck-btn--md"
        >
          {isPending ? "Saving…" : "Save system settings"}
        </button>
      </div>
    </div>
  );
}
