"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, FormField } from "@/components/ds";
import { SubmitButton } from "@/components/ds-client";
import { ConfirmDialog } from "@/components/confirm-dialog";
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

const BLOCK_CONSEQUENCE =
  "Blocking takes you both out of each other's discovery, releases any pending click, and ends any mutual or shared plan between you.";

export function ProfileSafetyControls({
  profileId,
  state,
}: {
  profileId: string;
  state: SafetyState;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const blockFormRef = useRef<HTMLFormElement>(null);

  // Acknowledge the report only once the server has actually recorded it:
  // hasReported arrives back through revalidation, so a post that never landed
  // can't produce a "we got it". Fires on the false -> true edge only, which
  // also keeps a revisit to an already-reported profile quiet.
  const reportedRef = useRef(state.hasReported);
  useEffect(() => {
    if (state.hasReported && !reportedRef.current) {
      setReportOpen(false);
      toast.success("Report sent. We've muted them too while our safety team reviews - within 24 hours.");
    }
    reportedRef.current = state.hasReported;
  }, [state.hasReported]);

  return (
    // Quiet, grouped by whitespace and a hairline - safety is available, never
    // shouted. The --danger fill lives on the block confirm inside the dialog,
    // never on a row button and never on coral.
    <section id="safety" className="mt-8 scroll-mt-24 border-t border-[color:var(--mist)] pt-6">
      <p className="eyebrow">Safety</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Block / unblock. Unblocking is one tap - it is reversible and adding
            friction there would teach people that these prompts are noise. */}
        <form ref={blockFormRef} action={state.isBlocked ? unblockUserAction : blockUserAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          {state.isBlocked ? (
            <SubmitButton variant="pending" size="sm" pendingLabel="Unblocking…">
              Blocked · undo
            </SubmitButton>
          ) : (
            <SubmitButton
              variant="secondary"
              size="sm"
              pendingLabel="Blocking…"
              onClick={(e) => {
                // Still a real submit, so with scripting off the block works as
                // it always did. With scripting on we intercept and route
                // through the confirm: block ends a mutual click, and nothing
                // in the UI can put that back.
                e.preventDefault();
                setConfirmBlock(true);
              }}
            >
              Block
            </SubmitButton>
          )}
        </form>

        {/* Mute / unmute - reversible both ways, so no confirm on either. */}
        <form action={state.isMuted ? unmuteUserAction : muteUserAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          {state.isMuted ? (
            <SubmitButton variant="pending" size="sm" pendingLabel="Unmuting…">
              Muted · undo
            </SubmitButton>
          ) : (
            <SubmitButton variant="secondary" size="sm" pendingLabel="Muting…">
              Mute
            </SubmitButton>
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
        {BLOCK_CONSEQUENCE} Muting stops notifications. Reporting someone mutes them too. Reports go to our safety team and are
        reviewed within 24 hours. The &ldquo;under review&rdquo; badge clears once that review closes - we
        don&rsquo;t share the outcome, and anyone you muted stays muted until you unmute them.
      </p>

      {reportOpen && !state.hasReported ? (
        <form action={reportUserAction} className="mt-5 grid max-w-[520px] gap-3.5">
          <input type="hidden" name="profile_id" value={profileId} />
          <FormField as="select" label="What happened?" name="reason" required defaultValue="">
            <option value="" disabled>
              Choose a reason…
            </option>
            {REPORT_REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FormField>
          <FormField
            as="textarea"
            label="Any detail that helps us review"
            name="details"
            rows={3}
            maxLength={2000}
            placeholder="Optional - what happened, and where."
            hint="Optional. Anything specific helps our team read the situation faster."
          />
          <div className="mt-1 flex gap-2">
            {/* Primary, not danger: filing a report opens a ticket, it doesn't
                destroy anything of the reporter's. The danger fill belongs on
                the block confirm below. */}
            <SubmitButton variant="primary" size="sm" pendingLabel="Sending…">
              Submit report
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirmBlock}
        title="Block this member?"
        description={`${BLOCK_CONSEQUENCE} You can unblock them later, but the mutual click doesn't come back.`}
        confirmLabel="Block"
        tone="rose"
        onConfirm={() => {
          setConfirmBlock(false);
          // requestSubmit (not submit) so React's form action still runs.
          blockFormRef.current?.requestSubmit();
        }}
        onCancel={() => setConfirmBlock(false)}
      />
    </section>
  );
}
