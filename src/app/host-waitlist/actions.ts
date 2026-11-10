"use server";

// No page lives in this folder - it holds the homepage host waitlist's server
// action only, so it is not a route.

import { headers } from "next/headers";
import { after } from "next/server";
import { logEmailEvent } from "@/lib/email";
import { SUPPORT_EMAIL_DEFAULT } from "@/lib/email-templates/tokens";
import {
  cleanEventTypes,
  cleanLine,
  cleanPhone,
  joinHostWaitlist,
} from "@/lib/host-waitlist";
import { cleanWaitlistEmail, siteOrigin, waitlistAreaFor, type WaitlistArea } from "@/lib/launch-waitlist";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type HostWaitlistField = "businessName" | "contactName" | "email" | "phone" | "place" | "website";

export type HostWaitlistValues = Record<HostWaitlistField, string> & { eventTypes: string[] };

export type HostWaitlistState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: Partial<Record<HostWaitlistField, string>>;
      message?: string;
      values: HostWaitlistValues;
    }
  | { status: "done"; area: WaitlistArea | null };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const LIMITS = { businessName: 120, contactName: 80, place: 80, website: 200 } as const;

/**
 * "Join the host waitlist" on the homepage. Public - no session - so it is rate
 * limited per IP, and it answers a repeat address exactly as it answers a new
 * one (see src/lib/host-waitlist.ts).
 */
export async function joinHostWaitlistAction(
  _previous: HostWaitlistState,
  formData: FormData,
): Promise<HostWaitlistState> {
  const values: HostWaitlistValues = {
    businessName: text(formData, "businessName"),
    contactName: text(formData, "contactName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    place: text(formData, "place"),
    website: text(formData, "website"),
    eventTypes: cleanEventTypes(formData.getAll("eventTypes")),
  };

  // A bot filled the field people never see (HostWaitlistForm's "leave_blank",
  // the same trap as /waitlist): tell it everything went fine and store nothing.
  if (text(formData, "leave_blank")) {
    return { status: "done", area: null };
  }

  const businessName = cleanLine(values.businessName);
  const contactName = cleanLine(values.contactName);
  const email = cleanWaitlistEmail(values.email);
  const rawPhone = cleanLine(values.phone);
  const phone = rawPhone ? cleanPhone(rawPhone) : null;
  const place = cleanLine(values.place);
  const website = cleanLine(values.website);

  const fieldErrors: Partial<Record<HostWaitlistField, string>> = {};
  if (!businessName) fieldErrors.businessName = "Add your business or venue name.";
  else if (businessName.length > LIMITS.businessName) fieldErrors.businessName = "Keep the name under 120 characters.";
  if (contactName && contactName.length > LIMITS.contactName) fieldErrors.contactName = "Keep your name under 80 characters.";
  if (!email) fieldErrors.email = "Check that email - it doesn't look quite right.";
  if (rawPhone && !phone) fieldErrors.phone = "Check that number - something like 0412 345 678.";
  if (place && place.length > LIMITS.place) fieldErrors.place = "Your suburb or postcode is all we need.";
  if (website && website.length > LIMITS.website) fieldErrors.website = "Keep the link under 200 characters.";
  if (!businessName || !email || Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors, values };
  }

  // Inside the try with the write: the limiter queries Postgres too, and an
  // outage there must come back as the form's own error, not a thrown action
  // that takes the homepage to its error boundary.
  try {
    // Tighter than /waitlist's 20: a venue signs up once, a script signs up a lot.
    const limit = await checkRateLimit({
      scope: "host-waitlist",
      identity: getClientIp({ headers: await headers() }),
      limit: 10,
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

    const { isNew } = await joinHostWaitlist({
      email,
      businessName,
      contactName,
      phone,
      place,
      eventTypes: values.eventTypes,
      website,
    });
    // The area of what was typed THIS time, not of the stored row - echoing
    // the stored one would tell a stranger where someone else said they host.
    const area = place ? waitlistAreaFor(place) : null;

    // First request only, and after the response so its cost can't be timed.
    // No form text goes into the email: anyone can type anyone's address here,
    // so the body is our copy only.
    if (isNew) {
      after(() =>
        logEmailEvent({
          template: "host-waitlist-joined",
          toEmail: email,
          vars: {
            areaLine:
              area === "outside"
                ? "Click opens in Sydney first - we'll tell you the moment it reaches you."
                : "We'll be in touch before bookings open to hear more about what you run.",
            discoverUrl: `${siteOrigin()}/discover`,
            supportEmail: SUPPORT_EMAIL_DEFAULT,
          },
        }),
      );
    }

    return { status: "done", area };
  } catch (error) {
    console.error("[host-waitlist] join failed", error);
    return {
      status: "error",
      fieldErrors: {},
      message: "Something went wrong on our side - try again in a moment.",
      values,
    };
  }
}
