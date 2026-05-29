"use client";

import { useState } from "react";
import {
  blockUserAction,
  muteUserAction,
  reportUserAction,
  unblockUserAction,
  unmuteUserAction,
} from "@/app/profile/[userId]/actions";

type SafetyState = {
  isBlocked: boolean;
  isMuted: boolean;
  hasReported: boolean;
};

const REPORT_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "harassment", label: "Harassment or threats" },
  { value: "inappropriate_messages", label: "Inappropriate behaviour" },
  { value: "spam_or_scam", label: "Spam or scam" },
  { value: "fake_profile", label: "Fake or impersonating profile" },
  { value: "safety_concern", label: "Safety concern" },
  { value: "other", label: "Something else" },
];

const pill =
  "rounded-full border-2 border-[color:var(--line)] px-4 py-2 text-xs font-bold uppercase tracking-wide hard-shadow-sm";

export function ProfileSafetyControls({
  profileId,
  state,
}: {
  profileId: string;
  state: SafetyState;
}) {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-4">
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        Safety
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Block / unblock */}
        <form action={state.isBlocked ? unblockUserAction : blockUserAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <button
            type="submit"
            className={`${pill} ${
              state.isBlocked
                ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            }`}
          >
            {state.isBlocked ? "Blocked · Undo" : "Block"}
          </button>
        </form>

        {/* Mute / unmute */}
        <form action={state.isMuted ? unmuteUserAction : muteUserAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <button
            type="submit"
            className={`${pill} ${
              state.isMuted
                ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
            }`}
          >
            {state.isMuted ? "Muted · Undo" : "Mute"}
          </button>
        </form>

        {/* Report */}
        {state.hasReported ? (
          <span className={`${pill} bg-[color:var(--champagne)] text-[color:var(--mauve)]`}>
            Reported · under review
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setReportOpen((v) => !v)}
            className={`${pill} bg-[color:var(--champagne)] text-[color:var(--rose)] hover:bg-[color:var(--peach)]`}
          >
            Report
          </button>
        )}
      </div>

      <p className="mt-3 text-xs font-medium leading-5 text-[color:var(--mauve)]">
        Blocking removes you from each other&apos;s discovery and cancels any pending Click. Muting
        stops notifications. Reports go to our safety team and are reviewed within 24 hours.
      </p>

      {reportOpen && !state.hasReported ? (
        <form
          action={reportUserAction}
          className="mt-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
        >
          <input type="hidden" name="profile_id" value={profileId} />
          <label className="block font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            What happened?
          </label>
          <select
            name="reason"
            required
            defaultValue=""
            className="mt-2 w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)]"
          >
            <option value="" disabled>
              Choose a reason…
            </option>
            {REPORT_REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <textarea
            name="details"
            rows={3}
            maxLength={2000}
            placeholder="Add any detail that helps us review (optional)."
            className="mt-3 w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-2 text-sm font-medium text-[color:var(--ink)]"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Submit report
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
