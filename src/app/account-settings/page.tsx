import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { AccountForm, PreferenceToggles } from "@/components/account-settings";
import { Pill, SectionIntro } from "@/components/click-ui";
import { getProfileForSettings } from "@/lib/event-repository";

export const metadata = {
  title: "Account settings | Click",
  description: "Manage your Click account, notifications, privacy, payments, and security.",
};

type TabId = "account" | "notifications" | "privacy" | "payments" | "security";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "account", label: "Account" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy" },
  { id: "payments", label: "Payments" },
  { id: "security", label: "Security" },
];

function resolveTab(value: string | undefined): TabId {
  return tabs.some((tab) => tab.id === value) ? (value as TabId) : "account";
}

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/account-settings");
  }

  const { tab } = await searchParams;
  const activeTab = resolveTab(tab);
  const profile = await getProfileForSettings(session);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <SectionIntro
          eyebrow="Account"
          title={<>Your <span className="italic">settings.</span></>}
          body="Update your profile, control notifications and privacy, manage payment methods and security."
        />

        <nav className="mt-8 flex flex-wrap gap-2" role="tablist">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                href={`/account-settings?tab=${tab.id}`}
                role="tab"
                aria-selected={active}
                className={
                  active
                    ? "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-5 py-2 text-sm font-bold text-[color:var(--champagne)] hard-shadow-sm"
                    : "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </section>

      <section className="mx-auto mt-10 max-w-5xl">
        {activeTab === "account" ? (
          <TabShell title="Account" body="Your public identity and where you Click from.">
            {profile ? (
              <AccountForm
                initialName={profile.displayName}
                initialSuburb={profile.suburb}
                initialBio={profile.bio}
                initialAge={profile.age}
                initialIntents={profile.intents.length ? profile.intents : ["friendship"]}
              />
            ) : (
              <p className="text-sm font-semibold text-[color:var(--mauve)]">
                We couldn&apos;t load your profile. The database may be offline.
              </p>
            )}
          </TabShell>
        ) : null}

        {activeTab === "notifications" ? (
          <TabShell title="Notifications" body="What we ping you about — saved client-side for now.">
            <PreferenceToggles
              storageKey="click:notification-prefs"
              options={[
                {
                  key: "event_reminders",
                  label: "Event reminders",
                  body: "Day-before nudges for events you've RSVP'd to.",
                  defaultValue: true,
                },
                {
                  key: "mutual_clicks",
                  label: "Mutual Clicks",
                  body: "Tell me when someone Clicks me back.",
                  defaultValue: true,
                },
                {
                  key: "weekly_picks",
                  label: "Weekly picks",
                  body: "A short Friday email with events worth your weekend.",
                  defaultValue: false,
                },
                {
                  key: "host_updates",
                  label: "Host announcements",
                  body: "Updates from hosts whose events you've joined.",
                  defaultValue: true,
                },
              ]}
            />
          </TabShell>
        ) : null}

        {activeTab === "privacy" ? (
          <TabShell title="Privacy" body="Control what other Click members can see.">
            <PreferenceToggles
              storageKey="click:privacy-prefs"
              options={[
                {
                  key: "dating_visible",
                  label: "Dating visibility",
                  body: "Appear in the dating side of the radar when your intent includes dating.",
                  defaultValue: false,
                },
                {
                  key: "flexible_discovery",
                  label: "Flexible discovery",
                  body: "Let people who matched another intent still find you.",
                  defaultValue: true,
                },
                {
                  key: "show_attended",
                  label: "Show events I've attended",
                  body: "Lets people see past events on your public profile.",
                  defaultValue: true,
                },
                {
                  key: "show_suburb",
                  label: "Show suburb publicly",
                  body: "Otherwise only the city shows on your profile.",
                  defaultValue: true,
                },
              ]}
            />
          </TabShell>
        ) : null}

        {activeTab === "payments" ? (
          <TabShell title="Payments" body="Cards on file for paid events.">
            <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-center">
              <p className="font-display text-2xl font-light leading-tight">
                No payment methods yet.
              </p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--mauve)]">
                Cards are added on checkout. We use Stripe — Click never stores card details.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                <Pill tone="ink">Stripe</Pill>
                <Pill tone="peach">PayPal soon</Pill>
              </p>
            </div>
          </TabShell>
        ) : null}

        {activeTab === "security" ? (
          <TabShell title="Security" body="Account access and sign-in.">
            <dl className="space-y-4">
              <SecurityRow label="Email" value={profile?.email ?? session.user.email ?? "—"} />
              <SecurityRow label="Sign-in method" value="Email magic link" />
              <SecurityRow label="Two-factor" value="Not enabled" />
            </dl>
            <form
              className="mt-8"
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-5 py-3 text-sm font-bold text-[color:var(--champagne)] hard-shadow-sm hover:bg-[color:var(--ink-deep)]"
              >
                Sign out everywhere
              </button>
            </form>
          </TabShell>
        ) : null}
      </section>
    </main>
  );
}

function TabShell({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm sm:p-8">
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
        {title}
      </p>
      <h2 className="font-display mt-2 text-3xl font-light leading-tight">
        {body}
      </h2>
      <div className="mt-6">{children}</div>
    </article>
  );
}

function SecurityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5">
      <dt className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </dt>
      <dd className="text-sm font-bold text-[color:var(--ink)]">{value}</dd>
    </div>
  );
}
