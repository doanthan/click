"use client";

import { useState } from "react";
import { Badge, Button, ckBtn } from "@/components/ds";
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

const field =
  "w-full rounded-[12px] border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3.5 py-2.5 text-[14.5px] text-[color:var(--ink)] outline-none focus-visible:border-[color:var(--purple)]";

export function ProfileSafetyControls({
  profileId,
  state,
}: {
  profileId: string;
  state: SafetyState;
}) {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    // Quiet, grouped by whitespace and a hairline - safety is available, never
    // shouted. Destructive confirms use --danger, never coral.
    <section id="safety" className="mt-8 scroll-mt-24 border-t border-[color:var(--mist)] pt-6">
      <p className="eyebrow">Safety</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Block / unblock */}
        <form action={state.isBlocked ? unblockUserAction : blockUserAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          {state.isBlocked ? (
            <button type="submit" className={ckBtn("pending", "sm")}>
              <span className="ck-btn__label">Blocked · undo</span>
            </button>
          ) : (
            <Button type="submit" variant="secondary" size="sm">
              Block
            </Button>
          )}
        </form>

        {/* Mute / unmute */}
        <form action={state.isMuted ? unmuteUserAction : muteUserAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          {state.isMuted ? (
            <button type="submit" className={ckBtn("pending", "sm")}>
              <span className="ck-btn__label">Muted · undo</span>
            </button>
          ) : (
            <Button type="submit" variant="secondary" size="sm">
              Mute
            </Button>
          )}
        </form>

        {/* Report */}
        {state.hasReported ? (
          <Badge tone="amber">Reported · under review</Badge>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setReportOpen((v) => !v)}
            aria-expanded={reportOpen}
          >
            Report
          </Button>
        )}
      </div>

      <p className="mt-3 max-w-[520px] text-[12.5px] leading-[1.55] text-[color:var(--slate)]">
        Blocking takes you both out of each other&apos;s discovery, releases any pending click, and
        ends any mutual or shared plan between you. Muting stops notifications. Reports go to our
        safety team and are reviewed within 24 hours.
      </p>

      {reportOpen && !state.hasReported ? (
        <form action={reportUserAction} className="mt-5 max-w-[520px]">
          <input type="hidden" name="profile_id" value={profileId} />
          <label className="block text-[13.5px] font-semibold text-[color:var(--ink)]">
            What happened?
          </label>
          <select name="reason" required defaultValue="" className={`mt-2 ${field}`}>
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
            className={`mt-3 resize-y ${field}`}
          />
          <div className="mt-3 flex gap-2">
            <Button type="submit" variant="danger" size="sm">
              Submit report
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
