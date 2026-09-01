"use client";

import { useActionState } from "react";
import { clickPersonAction } from "@/app/people/actions";
import { Button, ckBtn } from "./ds";
import { CLICK_SENT_LINE } from "@/lib/clicks/constants";

/**
 * The click control on someone's profile.
 *
 * /profile/[userId] was the one surface in the whole mechanic where you could
 * NOT click with the person - every card's quiet second action ("View profile")
 * landed you on a page whose only interactive controls were block, mute and
 * report. So the natural "let me read a bit more first" move was also the move
 * that took the action away.
 *
 * Rendered for every signed-in viewer on someone else's profile, unconditionally.
 * That is a privacy decision, not laziness: gating the button on eligibility
 * would turn this page into the probing oracle that createUserClickForSession's
 * constant-time floor and byte-identical outcomes exist to prevent. The action
 * itself does the gating, and its message is the same shape whatever the reason.
 */
export function ProfileClickButton({
  profileId,
  firstName,
  alreadyClicked,
}: {
  profileId: string;
  firstName: string;
  alreadyClicked: boolean;
}) {
  const [state, formAction, submitting] = useActionState(clickPersonAction, null);
  const sent = state?.ok === true || alreadyClicked;

  return (
    <form action={formAction} className="mt-5">
      <input type="hidden" name="profile_id" value={profileId} />
      {sent ? (
        <span className={ckBtn("pending", "md")} aria-live="polite">
          <span className="ck-btn__label">clicked</span>
        </span>
      ) : (
        <Button type="submit" variant="primary" size="md" loading={submitting}>
          click with {firstName}
        </Button>
      )}
      <p className="mt-2.5 text-[13px] leading-6 text-[color:var(--slate)]" role="status">
        {state?.message ??
          (sent
            ? CLICK_SENT_LINE
            : "Clicking is anonymous - we'll only show you if it's mutual.")}
      </p>
    </form>
  );
}
