import Link from "next/link";
import { auth } from "@/auth";
import { getProfileStatus } from "@/lib/event-repository";

// Spec §1 post-submission holding page. Shown to merchants whose application
// has landed but isn't yet approved by admin (verification_status='pending').
// The /merchant portal is gated until status='approved'. Anyone who isn't a
// pending/rejected merchant gets a clear access-denied state (no silent
// redirect) so the page never just "vanishes".

export const metadata = {
  title: "Application received | Click",
  description:
    "Your Click host application is being reviewed. Here's what to prepare while you wait.",
};

function AccessDenied({
  reason,
  showHostCta,
}: {
  reason: string;
  // When the visitor has no application on file, point them INTO the host
  // onboarding funnel instead of leaving "Back to Click" as the only exit —
  // "Host an event" should always lead to merchant onboarding, never a dead end.
  showHostCta?: boolean;
}) {
  return (
    <main className="paper-noise grid min-h-screen place-items-center bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto w-full max-w-xl rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-8 text-center hard-shadow sm:p-10">
        <span className="sticker sticker--rose tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--punch)]" />
          No access
        </span>
        <h1 className="font-display mt-6 text-4xl font-semibold leading-[0.98] tracking-[-0.025em] sm:text-5xl">
          {showHostCta ? "Want to host on Click?" : "You don’t have access to this page."}
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--mauve)]">
          {reason}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {showHostCta ? (
            <Link
              href="/merchant/signup"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
            >
              Start hosting →
            </Link>
          ) : null}
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-2.5 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
          >
            ← Back to Click
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function MerchantPendingPage() {
  const session = await auth();
  const status = session?.user ? await getProfileStatus(session) : null;
  const merchantProfile = status?.merchantProfile ?? null;

  if (
    !merchantProfile ||
    (merchantProfile.verification_status !== "pending" &&
      merchantProfile.verification_status !== "rejected")
  ) {
    let reason: string;
    let showHostCta = false;
    if (!session?.user) {
      reason =
        "This page is only for merchants reviewing their application status. Sign in, then start a host application to get going.";
      showHostCta = true;
    } else if (!merchantProfile) {
      reason =
        "You haven’t submitted a host application yet. Start the quick onboarding to list your first event.";
      showHostCta = true;
    } else {
      // verification_status === "approved"
      reason =
        "Your merchant application is already approved - your portal is live, so there’s no pending status to show.";
    }
    return <AccessDenied reason={reason} showHostCta={showHostCta} />;
  }

  const rejected = merchantProfile.verification_status === "rejected";

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.5fr_0.5fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <span className={`sticker ${rejected ? "sticker--rose" : "sticker--peach"} tilt-l-2 inline-flex`}>
            <span className={`size-2 rounded-full ${rejected ? "bg-[color:var(--punch)]" : "bg-[color:var(--rose)] pulse-ring"}`} />
            {rejected ? "Application needs another look" : "Application received"}
          </span>

          <h1 className="font-display mt-6 text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
            {rejected ? (
              <>
                We need to <span className="text-[color:var(--coral)]">talk it over</span>.
              </>
            ) : (
              <>
                Thanks, <span className="text-[color:var(--coral)]">we’re on it</span>.
              </>
            )}
          </h1>

          <p className="mt-6 max-w-xl text-base font-medium leading-7 text-[color:var(--mauve)]">
            {rejected
              ? "An admin reviewed your application and flagged something. Check your email for the reason and resubmit when you’ve addressed it."
              : "Your merchant application is in the admin queue. We aim to review new merchants within 1 business day. We’ll email you the moment your portal unlocks."}
          </p>

          <p className="mt-6 text-sm font-bold text-[color:var(--ink)]">
            Application for: <span className="font-display font-semibold text-[color:var(--purple)]">{merchantProfile.business_name}</span>
          </p>
          <p className="mt-1 text-sm font-medium text-[color:var(--mauve)]">
            Contact email on file: {merchantProfile.contact_email}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-2.5 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
            >
              ← Use Click as an attendee
            </Link>
            {rejected ? (
              <Link
                href="/merchant/signup"
                className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
              >
                Resubmit application →
              </Link>
            ) : null}
          </div>
        </div>

        {/*
          A rejected merchant must NOT see the "get your first event live"
          prep checklist — it reads as "you can create events now" even though
          they can't (bug board #204). Steer them to fix + resubmit instead.
        */}
        {rejected ? (
          <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow">
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              What happens next
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
              Update your application and resubmit.
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-[color:var(--mauve)]">
              Your application isn’t live yet, so you can’t create events until it’s
              approved. Check the rejection email for the specific reason, fix that in
              your application, and send it back for review.
            </p>
            <ol className="mt-6 grid gap-4">
              {[
                {
                  t: "Read the reason in your email",
                  d: "We emailed the contact address on file with exactly what the admin flagged.",
                },
                {
                  t: "Update the flagged details",
                  d: "Reopen your application - your previous answers are still there to edit.",
                },
                {
                  t: "Resubmit for review",
                  d: "Once you resubmit, your application goes back into the admin queue and we’ll email you the outcome.",
                },
              ].map((step, idx) => (
                <li
                  key={step.t}
                  className="flex gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] font-mono text-sm font-bold text-[color:var(--surface-deep)]">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-[color:var(--ink)]">{step.t}</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/merchant/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
            >
              Resubmit application →
            </Link>
          </div>
        ) : (
        /* First-event prep checklist per spec §1 post-submission. */
        <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            While you wait
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em]">
            Get your first event live in 15 minutes - prep these now.
          </h2>

          <ol className="mt-6 grid gap-4">
            {[
              {
                t: "Pick your strongest event idea",
                d: "Strong titles include the activity + vibe: ‘Thursday Pottery for Beginners’, not ‘Pottery Class’.",
              },
              {
                t: "Choose a high-traffic suburb for launch",
                d: "Inner-city Sydney events fill fastest. Surry Hills, Newtown, and Darlinghurst are the best starting points.",
              },
              {
                t: "Plan an intimate first event (10–20 people)",
                d: "Smaller events convert better on Click. Save big events for after you’ve built an audience.",
              },
              {
                t: "Connect Stripe for paid events",
                d: "Required before you can charge. You’ll be prompted at Step 3 of the event wizard if Stripe isn’t connected.",
              },
              {
                t: "Tag richly",
                d: "Users filter by tags. A cooking class can be Food + Social + Learning + Creative - pick all that fit.",
              },
            ].map((step, idx) => (
              <li
                key={step.t}
                className="flex gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] font-mono text-sm font-bold text-[color:var(--surface-deep)]">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-bold text-[color:var(--ink)]">{step.t}</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--mauve)]">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]/70">
            ✷ We’ll email you when approval lands ✷
          </p>
        </div>
        )}
      </section>
    </main>
  );
}
