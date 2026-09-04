import Link from "next/link";
import { auth } from "@/auth";
import { getGuestSpotByToken } from "@/lib/event-repository";
import { GuestClaimActions } from "./claim-actions";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ action?: string }>;
};

// Deliberately generic, and deliberately noindex. The URL carries a one-time
// guest token, so it gets pasted into group chats where the preview card is
// visible to everyone in the thread - the title must not name the event, the
// host or whoever bought the seat. Crawlers have no business here either.
export const metadata = {
  title: "Your guest spot",
  description: "Claim the seat a friend saved for you on Click.",
  robots: { index: false, follow: false },
};

const SANS = "var(--font-click-body), system-ui, -apple-system, sans-serif";

const SHELL: React.CSSProperties = {
  minHeight: "100dvh",
  background: "var(--champagne)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 16px",
};

const CARD: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  background: "var(--cream)",
  border: "1px solid var(--line)",
  borderRadius: 16,
  padding: "40px 32px",
};

const KICKER: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--mauve)",
  margin: "0 0 12px",
};

const DISPLAY = "var(--font-click-display), system-ui, -apple-system, sans-serif";

const TITLE: React.CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "var(--ink)",
  lineHeight: 1.2,
  margin: "0 0 12px",
};

const BODY: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 16,
  color: "var(--ink)",
  lineHeight: 1.6,
  margin: "0 0 24px",
};

const LINK: React.CSSProperties = { color: "var(--purple)", fontWeight: 600 };

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main style={SHELL}>
      <div style={CARD}>
        <p style={KICKER}>Click · Guest spot</p>
        {children}
      </div>
    </main>
  );
}

export default async function ClaimPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const action = (await searchParams)?.action;
  const [spot, session] = await Promise.all([getGuestSpotByToken(token), auth()]);
  const signedIn = Boolean(session?.user);

  const when = [spot.eventLongDate, spot.suburb].filter(Boolean).join(" · ");
  const purchaser = spot.purchaserName?.split(/\s+/)[0] || "A friend";

  // Terminal states (spec §7 state table).
  if (spot.state === "not_found") {
    return (
      <Frame>
        <h1 style={TITLE}>This link isn&apos;t valid.</h1>
        <p style={BODY}>The link may be mistyped. Ask {purchaser} to resend your invite.</p>
      </Frame>
    );
  }
  if (spot.state === "expired") {
    return (
      <Frame>
        <h1 style={TITLE}>This link has expired.</h1>
        <p style={BODY}>Ask {purchaser} to resend your invite to {spot.eventTitle}.</p>
      </Frame>
    );
  }
  // Terminal only when they arrived with no action. This guard used to sit above
  // the release / remove blocks below and swallow them, so the "Can't make it?"
  // link in the invite email landed a guest who HAD claimed on "You've already
  // joined" with no way out - and claiming writes no event_attendees row
  // (claimGuestSpotForProfile only updates guest_spots), so there was nothing to
  // cancel from a dashboard either. Both flows accept a claimed seat at the data
  // layer already: releaseGuestSpotByToken matches `status in ('invited',
  // 'claimed')` and removeGuestDetailsByToken matches anything but 'cancelled'.
  if (spot.state === "claimed" && !action) {
    return (
      <Frame>
        <h1 style={TITLE}>You&apos;ve already joined.</h1>
        <p style={BODY}>Your spot at {spot.eventTitle} is set.</p>
        <Link href="/login" style={LINK}>Sign in →</Link>
        <p style={{ ...BODY, fontSize: 13, color: "var(--mauve)", margin: "28px 0 0", textAlign: "center" }}>
          Can&apos;t make it?{" "}
          <Link href={`/claim/${token}?action=release`} style={LINK}>Let {purchaser} know</Link>
          {" · "}
          <Link href={`/claim/${token}?action=remove`} style={LINK}>Remove my details</Link>
        </p>
      </Frame>
    );
  }
  if (spot.state === "gone") {
    return (
      <Frame>
        <h1 style={TITLE}>This spot is no longer held.</h1>
        <p style={BODY}>The seat for {spot.eventTitle} isn&apos;t available anymore.</p>
      </Frame>
    );
  }

  // Valid + live. Release / remove flows (token-authenticated, no account needed).
  if (action === "release") {
    return (
      <Frame>
        <h1 style={TITLE}>Hand your spot back?</h1>
        <p style={BODY}>
          This returns your seat at <strong>{spot.eventTitle}</strong> to {purchaser}. You won&apos;t be charged anything - the seat was always theirs.
        </p>
        <GuestClaimActions token={token} action="release" />
      </Frame>
    );
  }
  if (action === "remove") {
    return (
      <Frame>
        <h1 style={TITLE}>Remove your details?</h1>
        <p style={BODY}>
          We&apos;ll delete the name and email {purchaser} shared and won&apos;t hold them. The seat stays theirs to bring someone. This can&apos;t be undone.
        </p>
        <GuestClaimActions token={token} action="remove" />
      </Frame>
    );
  }

  // Default: the claim invitation.
  return (
    <Frame>
      <h1 style={TITLE}>
        {spot.guestFirstName ? `Hey ${spot.guestFirstName}, ` : ""}{purchaser} saved you a spot.
      </h1>
      <p style={BODY}>
        You&apos;ve got a seat at <strong>{spot.eventTitle}</strong>
        {when ? ` - ${when}` : ""}.
      </p>

      {signedIn ? (
        <GuestClaimActions token={token} action="claim" redirectSlug={spot.eventSlug} />
      ) : (
        <div style={{ textAlign: "center" }}>
          <Link
            href={`/register?callbackUrl=${encodeURIComponent(`/claim/${token}`)}`}
            style={{
              display: "inline-block",
              background: "var(--purple)",
              color: "var(--cream)",
              fontFamily: SANS,
              fontSize: 16,
              fontWeight: 600,
              padding: "14px 28px",
              borderRadius: 12,
              textDecoration: "none",
            }}
          >
            Create your account to claim →
          </Link>
          <p style={{ ...BODY, fontSize: 14, color: "var(--mauve)", margin: "16px 0 0" }}>
            Already on Click? <Link href={`/login?callbackUrl=${encodeURIComponent(`/claim/${token}`)}`} style={LINK}>Sign in</Link> to claim, then come back to this link.
          </p>
        </div>
      )}

      <p style={{ ...BODY, fontSize: 13, color: "var(--mauve)", margin: "28px 0 0", textAlign: "center" }}>
        Can&apos;t make it?{" "}
        <Link href={`/claim/${token}?action=release`} style={LINK}>Let {purchaser} know</Link>
        {" · "}
        <Link href={`/claim/${token}?action=remove`} style={LINK}>Remove my details</Link>
      </p>
    </Frame>
  );
}
