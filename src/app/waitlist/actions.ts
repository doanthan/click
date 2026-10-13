"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { logEmailEvent } from "@/lib/email";
import { SUPPORT_EMAIL_DEFAULT } from "@/lib/email-templates/tokens";
import {
  cleanReferralCode,
  cleanWaitlistEmail,
  joinLaunchWaitlist,
  newReferralCode,
  waitlistAreaFor,
  waitlistLinks,
  type WaitlistArea,
} from "@/lib/launch-waitlist";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type InviteRequestState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: { email?: string; place?: string };
      message?: string;
      values: { email: string; place: string };
    }
  | { status: "done"; area: WaitlistArea; shareUrl: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * "Request an invite" on /waitlist. Public - no session - so it is rate limited
 * per IP, and it answers a repeat address exactly as it answers a new one (see
 * src/lib/launch-waitlist.ts).
 */
export async function requestInvite(
  _previous: InviteRequestState,
  formData: FormData,
): Promise<InviteRequestState> {
  const rawEmail = text(formData, "email");
  const place = text(formData, "place").trim().replace(/\s+/g, " ");
  const values = { email: rawEmail, place };

  // A bot filled the field people never see (WaitlistForm's "leave_blank",
  // named so no autofill matches it): tell it everything went fine and store
  // nothing. The code is a throwaway that no row holds.
  if (text(formData, "leave_blank")) {
    return { status: "done", area: "pilot", shareUrl: waitlistLinks(newReferralCode()).shareUrl };
  }

  const email = cleanWaitlistEmail(rawEmail);
  const fieldErrors: { email?: string; place?: string } = {};
  if (!email) fieldErrors.email = "Check that email - it doesn't look quite right.";
  if (!place) fieldErrors.place = "Add your suburb or postcode.";
  else if (place.length > 80) fieldErrors.place = "Your suburb or postcode is all we need.";
  if (!email || fieldErrors.place) return { status: "error", fieldErrors, values };

  // A household or an office shares one address, so this is generous for
  // people and tight for a script.
  const limit = await checkRateLimit({
    scope: "launch-waitlist",
    identity: getClientIp({ headers: await headers() }),
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) {
    return {
      status: "error",
      fieldErrors: {},
      message: "That's a lot of requests from one place - give it a little while and try again.",
      values,
    };
  }

  try {
    const { referralCode, isNew } = await joinLaunchWaitlist({
      email,
      place,
      ref: cleanReferralCode(text(formData, "ref")),
    });
    const { shareUrl, howItWorksUrl } = waitlistLinks(referralCode);
    // The area of what was typed THIS time, not of the stored row - echoing
    // the stored one would tell a stranger where someone else said they live.
    const area = waitlistAreaFor(place);

    // First request only, and after the response so its cost can't be timed.
    if (isNew) {
      after(() =>
        logEmailEvent({
          template: "launch-waitlist-joined",
          toEmail: email,
          vars: {
            areaLine:
              area === "pilot"
                ? "We'll be in touch when your suburb opens."
                : "We'll tell you the moment Click reaches you.",
            shareUrl,
            // The link as shown: short enough to sit on one line on a phone.
            shareLabel: shareUrl.replace(/^https?:\/\/(www\.)?/, ""),
            howItWorksUrl,
            supportEmail: SUPPORT_EMAIL_DEFAULT,
          },
        }),
      );
    }

    return { status: "done", area, shareUrl };
  } catch (error) {
    console.error("[waitlist] invite request failed", error);
    return {
      status: "error",
      fieldErrors: {},
      message: "Something went wrong on our side - try again in a moment.",
      values,
    };
  }
}
