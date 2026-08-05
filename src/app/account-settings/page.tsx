import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountSettingToggle } from "@/components/account-setting-toggle";
import { Button, ButtonLink, Icon, type IconName } from "@/components/ds";
import { EmptyState } from "@/components/empty-state";
import { signOutOfClick } from "@/app/login/actions";
import { getOwnProfile, type AccountSettings } from "@/lib/event-repository";
import { SettingsTabs } from "./settings-tabs";

const DEFAULT_SETTINGS: AccountSettings = {
  notifications: {
    eventReminders: true,
    waitlistOffers: true,
    mutualClick: true,
    weeklyRecap: false,
    productUpdates: false,
  },
  showSuburb: true,
  showAttendanceCount: true,
  allowMerchantMessages: false,
};

export const metadata = {
  title: "Settings",
};

type TabKey = "account" | "notifications" | "privacy" | "payments" | "security";
const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "account", label: "Account", icon: "user" },
  { key: "notifications", label: "Notifications", icon: "bell" },
  { key: "privacy", label: "Privacy & visibility", icon: "eye" },
  { key: "payments", label: "Payments", icon: "ticket" },
  { key: "security", label: "Security", icon: "lock" },
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
  const settings = profile?.settings ?? DEFAULT_SETTINGS;

  /* Every panel is built here, once, from the single settings object above -
     all five derive from it, so re-running this per tab bought nothing. They go
     to SettingsTabs as ReactNodes: the fetching stays on the server, only the
     "which one is showing" moved to the client. */
  const panels: Record<TabKey, React.ReactNode> = {
    account: (
      <AccountTab
        displayName={profile?.displayName ?? "-"}
        email={profile?.email ?? session.user.email ?? "-"}
        suburb={profile?.suburb ?? "-"}
      />
    ),
    notifications: <NotificationsTab settings={settings} />,
    privacy: <PrivacyTab settings={settings} />,
    payments: <PaymentsTab />,
    security: <SecurityTab email={profile?.email ?? session.user.email ?? "-"} />,
  };

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <h1 className="font-display text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em]">
          Settings
        </h1>

        <SettingsTabs tabs={TABS} initialTab={tab} panels={panels} />
      </div>
    </main>
  );
}

function AccountTab({
  displayName,
  email,
  suburb,
}: {
  displayName: string;
  email: string;
  suburb: string;
}) {
  return (
    <>
      <Group>
        <SectionHead sub="What other members see when you meet at an event.">
          Your details
        </SectionHead>
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label="Display name" value={displayName} />
          <ReadOnlyField label="Suburb" value={suburb} />
          <ReadOnlyField label="Email" value={email} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/profile/edit" size="sm">
            Edit profile
          </ButtonLink>
          <ButtonLink href="/profile" size="sm" variant="secondary">
            View your profile
          </ButtonLink>
        </div>
      </Group>

      <Group last>
        <SectionHead>Membership</SectionHead>
        <SignOutRow />
      </Group>
    </>
  );
}

function NotificationsTab({ settings }: { settings: AccountSettings }) {
  const n = settings.notifications;
  return (
    <Group last>
      <SectionHead sub="What we email and notify you about. Separate from the in-app bell.">
        Notify me about
      </SectionHead>
      <div className="-mx-3 grid gap-1">
        <AccountSettingToggle
          settingKey="notify.mutualClick"
          label="Mutual clicks"
          description="When you and someone both clicked."
          initialOn={n.mutualClick}
        />
        <AccountSettingToggle
          settingKey="notify.eventReminders"
          label="Event reminders"
          description="A nudge the day before something you've booked."
          initialOn={n.eventReminders}
        />
        <AccountSettingToggle
          settingKey="notify.waitlistOffers"
          label="Waitlist offers"
          description="When a spot opens on something you're waiting for."
          initialOn={n.waitlistOffers}
        />
        <AccountSettingToggle
          settingKey="notify.weeklyRecap"
          label="Weekly digest"
          description="What's on near you, once a week."
          initialOn={n.weeklyRecap}
        />
        <AccountSettingToggle
          settingKey="notify.productUpdates"
          label="Product news"
          description="Occasional updates from Click."
          initialOn={n.productUpdates}
        />
      </div>
      <p className="mt-5 text-[13px] leading-6 text-[color:var(--slate)]">
        Your in-app inbox lives at{" "}
        <Link
          href="/notifications"
          className="font-semibold text-[color:var(--purple)] hover:underline"
        >
          Notifications
        </Link>
        .
      </p>
    </Group>
  );
}

function PrivacyTab({ settings }: { settings: AccountSettings }) {
  return (
    <Group last>
      <SectionHead sub="Click is private by default. You only ever hear about the people who clicked with you too.">
        Who sees you, and when
      </SectionHead>
      <div className="-mx-3 grid gap-1">
        <AccountSettingToggle
          settingKey="showSuburb"
          label="Show my suburb"
          description="Your suburb shows on your profile. Off means only your city does."
          initialOn={settings.showSuburb}
        />
        <AccountSettingToggle
          settingKey="showAttendanceCount"
          label="Show how many events I've been to"
          description="The count on your profile - never which events."
          initialOn={settings.showAttendanceCount}
        />
        <AccountSettingToggle
          settingKey="allowMerchantMessages"
          label="Let hosts message me"
          description="Only hosts of events you've RSVP'd to, and only about those events."
          initialOn={settings.allowMerchantMessages}
        />
      </div>
      <p className="mt-5 text-[13px] leading-6 text-[color:var(--slate)]">
        Dating mode lives with the Open-to-dating intent in{" "}
        <Link
          href="/profile/edit"
          className="font-semibold text-[color:var(--purple)] hover:underline"
        >
          Edit profile
        </Link>
        .
      </p>
    </Group>
  );
}

function PaymentsTab() {
  return (
    <Group last>
      <SectionHead sub="Used for paid event RSVPs. Card details live in Stripe, never on Click's servers.">
        Cards on file
      </SectionHead>
      {/* The DS empty state, not a one-off card: the bespoke version used a
          white --paper panel where every other empty state in the product uses
          the --lav-bg wash. */}
      <EmptyState
        eyebrow="Nothing here yet"
        title="No saved cards yet."
        body="Add one next time you book a paid event, and it'll rest here."
        icon={<Icon name="ticket" size={22} />}
      />
    </Group>
  );
}

function SecurityTab({ email }: { email: string }) {
  return (
    <Group last>
      {/* Says only what ships. The old copy promised "sign out everywhere" - the
          control below is the ordinary single-session sign-out, and someone who
          had genuinely lost a phone would have pressed it and believed the other
          device was safe. It also promised a two-step confirm on a delete that
          does not exist yet. When delete lands, build it on ConfirmDialog with
          promptRequired so the user types their email. */}
      <SectionHead sub="Sign out of this browser. Account deletion is coming soon.">
        Sessions and access
      </SectionHead>
      <dl className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Signed in as" value={email} />
      </dl>
      <div className="mt-5 grid gap-1">
        <SignOutRow />
        <div>
          <Button type="button" variant="ghost" size="sm" disabled>
            Delete account · coming soon
          </Button>
        </div>
      </div>
    </Group>
  );
}

/* One sign-out row, rendered on both the Account and Security tabs. It used to
   be two byte-identical copies of a 40-character class string that had to stay
   in sync. Signing out is not destructive - a quiet Ink row with a lavender-tint
   hover, never error red. */
function SignOutRow() {
  return (
    <form action={signOutOfClick}>
      <button
        type="submit"
        className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[14.5px] font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)] sm:w-auto sm:min-w-[280px]"
      >
        <Icon name="logout" size={18} className="text-[color:var(--slate)]" />
        Sign out
      </button>
    </form>
  );
}

/* Sections group with whitespace + ONE hairline. No cards inside cards. */
function Group({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`py-6 ${last ? "" : "border-b border-[color:var(--mist)]"}`}>{children}</div>
  );
}

function SectionHead({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3.5">
      <h3 className="eyebrow">{children}</h3>
      {sub ? (
        <p className="mt-1.5 max-w-[520px] text-[13px] leading-[1.5] text-[color:var(--slate)]">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-[7px] text-[13.5px] font-semibold text-[color:var(--ink)]">{label}</dt>
      <dd className="flex h-12 items-center break-all rounded-[12px] border border-[color:var(--mist)] bg-[color:var(--champagne-deep)] px-3.5 text-[15px] text-[color:var(--slate)]">
        {value}
      </dd>
    </div>
  );
}
