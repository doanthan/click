"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SubmitButton } from "@/components/ds-client";
import { resolveReportAction, suspendFromReportAction } from "./actions";

/**
 * The moderation controls on one safety-report card.
 *
 * Client-side only for the confirmation gate. Both halves are still real
 * <form action={serverAction}> posts and Suspend is still a native submit, so
 * with scripting off the dialog simply never opens and the queue behaves
 * exactly as it did before - the submit is never gated on the dialog.
 *
 * Dismiss and Mark actioned share ONE form so the optional resolution note can
 * feed either outcome without a second input; the outcome rides in on the
 * submit button's name/value, which is what resolveReportAction already reads.
 * Both are reversible status changes, so they stay one tap. Only Suspend gets
 * the gate: it locks a real member out of the product AND auto-closes the
 * report, so a mis-aimed tap in a fast queue is no longer visible afterwards.
 * That matches the two-step confirm + reason the same operation already has in
 * admin-members-table.tsx.
 */
export function ReportCardActions({
  reportId,
  reportedId,
  reportedName,
  defaultSuspendReason,
  alreadySuspended,
}: {
  reportId: string;
  reportedId: string;
  reportedName: string;
  /** Used when the operator leaves the reason blank, so the log is never empty. */
  defaultSuspendReason: string;
  alreadySuspended: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const suspendFormRef = useRef<HTMLFormElement>(null);
  const suspendReasonRef = useRef<HTMLInputElement>(null);

  // The dialog writes the typed reason into the hidden field the server action
  // already reads, then submits the real form - so the audit log records WHY
  // rather than the old hardcoded "Safety report: …" string.
  function confirmSuspend(reason: string) {
    setConfirming(false);
    if (suspendReasonRef.current) {
      suspendReasonRef.current.value = reason.trim() || defaultSuspendReason;
    }
    suspendFormRef.current?.requestSubmit();
  }

  return (
    <div className="mt-4">
      <form action={resolveReportAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="report_id" value={reportId} />
        <label className="grid min-w-[14rem] flex-1 gap-1.5">
          <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
            Resolution note (optional)
          </span>
          <input
            name="note"
            maxLength={280}
            placeholder="Why this call was made - kept on the report"
            className="ck-input w-full"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {/* No pendingLabel: useFormStatus reports the whole form, so a label
              swap would put the wrong verb on the button that was not pressed.
              Button's spinner + aria-busy carry the in-flight state instead. */}
          <SubmitButton name="resolution" value="dismissed" variant="secondary" size="sm">
            Dismiss
          </SubmitButton>
          <SubmitButton name="resolution" value="actioned" variant="primary" size="sm">
            Mark actioned
          </SubmitButton>
        </div>
      </form>

      {!alreadySuspended ? (
        <form ref={suspendFormRef} action={suspendFromReportAction} className="mt-3">
          <input type="hidden" name="report_id" value={reportId} />
          <input type="hidden" name="reported_id" value={reportedId} />
          <input
            ref={suspendReasonRef}
            type="hidden"
            name="reason"
            defaultValue={defaultSuspendReason}
          />
          <SubmitButton
            variant="danger"
            size="sm"
            onClick={(event) => {
              // With JS off this handler never runs and the form posts straight
              // through, which is the pre-existing behaviour - not a regression.
              event.preventDefault();
              setConfirming(true);
            }}
          >
            Suspend account
          </SubmitButton>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={`Suspend ${reportedName}?`}
        description="They lose access to Click straight away and this report closes as actioned. Lift it again from the Members table."
        confirmLabel="Suspend account"
        tone="rose"
        promptLabel="Suspension reason (kept in the audit log)"
        promptPlaceholder={defaultSuspendReason}
        promptMultiline={false}
        onConfirm={confirmSuspend}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
