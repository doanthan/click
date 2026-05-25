import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LinkButton, Pill } from "@/components/click-ui";
import { signOutOfClick } from "@/app/login/actions";
import { getOwnProfile } from "@/lib/event-repository";

export const metadata = {
  title: "Account settings | Click",
};

type TabKey = "account" | "notifications" | "privacy" | "payments" | "security";
const TABS: { key: TabKey; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "notifications", label: "Notifications" },
  { key: "privacy", label: "Privacy" },
  { key: "payments", label: "Payments" },
  { key: "security", label: "Security" },
];

type AccountSettingsPageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function AccountSettingsPage({ searchParams }: AccountSettingsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/account-settings");
  }

  const params = await searchParams;
  const tabKey = (params?.tab as TabKey | undefined) ?? "account";
  const tab: TabKey = TABS.some((t) => t.key === tabKey) ? tabKey : "account";

  const profile = await getOwnProfile(session);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Settings
        </span>
        <h1 className="mt-6 font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          Account settings
        </h1>
        <p className="mt-3 text-base font-medium leading-7 text-[color:var(--mauve)]">
          Edit your profile, control notifications, manage privacy and payments,
          and sign out from your devices.
        </p>

        <nav className="mt-8 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={`/account-settings?tab=${t.key}`}
                className={`rounded-full border-2 border-[color:var(--line)] px-4 py-2 text-xs font-bold uppercase tracking-wide hard-shadow-sm ${
                  active
                    ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : "bg-[color:var(--cream)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm sm:p-8">
          {tab === "account" ? (
            <AccountTab
              displayName={profile?.displayName ?? "—"}
              email={profile?.email ?? session.user.email ?? "—"}
              suburb={profile?.suburb ?? "—"}
              role={profile?.role ?? "attendee"}
            />
          ) : null}
          {tab === "notifications" ? <NotificationsTab /> : null}
          {tab === "privacy" ? <PrivacyTab /> : null}
          {tab === "payments" ? <PaymentsTab /> : null}
          {tab === "security" ? <SecurityTab email={profile?.email ?? session.user.email ?? "—"} /> : null}
        </div>
      </section>
    </main>
  );
}

function AccountTab({
  displayName,
  email,
  suburb,
  role,
}: {
  displayName: string;
  email: string;
  suburb: string;
  role: string;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Your profile"
        title="Public details"
        body="What other Click users see when they meet you at an event."
      />
      <dl className="grid gap-3 sm:grid-cols-2">
        <Row label="Display name" value={displayName} />
        <Row label="Email" value={email} />
        <Row label="Suburb" value={suburb} />
        <Row label="Role" value={role} />
      </dl>
      <div className="flex flex-wrap gap-3 pt-2">
        <LinkButton href="/profile/edit">Edit profile</LinkButton>
        <Link
          href="/profile"
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
        >
          View your profile
        </Link>
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Notifications"
        title="What you hear from Click"
        body="Manage how often we send you reminders, mutual Click alerts, and weekly recap emails."
      />
      <div className="space-y-3">
        <ToggleRow label="Event reminders (24h before)" defaultOn />
        <ToggleRow label="Waitlist offers" defaultOn />
        <ToggleRow label="Mutual Click alerts" defaultOn />
        <ToggleRow label="Weekly recap email" defaultOn={false} />
        <ToggleRow label="Product updates" defaultOn={false} />
      </div>
      <p className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
        Toggle persistence ships with the notification-preferences migration —
        in the meantime, your in-app inbox lives at{" "}
        <Link
          href="/notifications"
          className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
        >
          /notifications
        </Link>
        .
      </p>
    </div>
  );
}

function PrivacyTab() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Privacy"
        title="Who sees you, and when"
        body="Click is private by default. Mutual interest unlocks suggestions, not chat."
      />
      <div className="space-y-3">
        <ToggleRow label="Visible to dating intent users" defaultOn />
        <ToggleRow label="Flexible discovery (show me cross-intent events)" defaultOn />
        <ToggleRow label="Show my attendance count on my public profile" defaultOn />
        <ToggleRow label="Allow merchants I’ve RSVPd to message me" defaultOn={false} />
      </div>
      <p className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
        Persisted privacy toggles land with the upcoming onboarding migration.
      </p>
    </div>
  );
}

function PaymentsTab() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Payments"
        title="Cards on file"
        body="Used for paid event RSVPs. Card data lives in Stripe, never on Click servers."
      />
      <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-6 text-center">
        <p className="font-display text-2xl font-light leading-tight">
          No saved cards yet.
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Add a card the next time you book a paid event. Stripe Customer-level
          cards UI lands with the Stripe Connect onboarding work.
        </p>
      </div>
    </div>
  );
}

function SecurityTab({ email }: { email: string }) {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Security"
        title="Sessions and access"
        body="Sign out everywhere if you’ve lost a device. Account deletion is a permanent step we’d ask you to confirm twice."
      />
      <dl className="grid gap-3 sm:grid-cols-2">
        <Row label="Signed in as" value={email} />
        <Row label="Session strategy" value="JWT (NextAuth)" />
      </dl>
      <div className="flex flex-wrap gap-3 pt-2">
        <form action={signOutOfClick}>
          <button
            type="submit"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
          >
            Sign out
          </button>
        </form>
        <button
          type="button"
          disabled
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--mauve)] opacity-60"
        >
          Delete account · coming soon
        </button>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
        {eyebrow}
      </span>
      <h2 className="mt-2 font-display text-3xl font-light leading-tight">
        {title}
      </h2>
      <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
        {body}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3 hard-shadow-sm">
      <dt className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold text-[color:var(--ink)] break-all">
        {value}
      </dd>
    </div>
  );
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 hard-shadow-sm">
      <span className="text-sm font-bold text-[color:var(--ink)]">{label}</span>
      <span className="flex items-center gap-2">
        <Pill tone={defaultOn ? "peach" : "cream"}>{defaultOn ? "On" : "Off"}</Pill>
        <input
          type="checkbox"
          defaultChecked={defaultOn}
          disabled
          className="size-5 accent-[color:var(--rose)] cursor-not-allowed opacity-60"
        />
      </span>
    </label>
  );
}
