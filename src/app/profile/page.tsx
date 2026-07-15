import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Avatar, Badge, ButtonLink, Icon, Tag } from "@/components/ds";
import { VerifiedTick } from "@/components/verified-tick";
import { formatIntent } from "@/lib/click-data";
import { getConfirmedEvents, getOwnProfile } from "@/lib/event-repository";

export const metadata = {
  title: "Your profile | Click",
};

export default async function OwnProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile");
  }

  const [profile, confirmed] = await Promise.all([
    getOwnProfile(session),
    getConfirmedEvents(session),
  ]);

  if (!profile) {
    redirect("/onboarding");
  }

  const pastEvents = confirmed.past;

  // Fall back to the OAuth provider photo (same source the header uses) when we
  // haven't rehosted an avatar yet - otherwise a user with a Google/Facebook
  // picture sees initials here while the header shows their real photo.
  const avatarUrl = profile.photoUrl ?? session.user.image ?? null;

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      {/* Narrow page: capped at its natural width, LEFT-aligned at the container
          gutter - the whitespace falls to the right, never a centred column. */}
      <div className="ck-page pt-8">
        <div className="max-w-[660px]">
          <article className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
            {/* Header - avatar · text column · action, all on one axis */}
            <header className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4 sm:gap-[18px]">
                <Avatar name={profile.displayName} src={avatarUrl} size={72} ring />
                <div className="min-w-0">
                  <p className="eyebrow">Your profile</p>
                  <h1 className="font-display mt-1.5 text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em]">
                    {profile.displayName}
                    {profile.age ? ` · ${profile.age}` : ""}
                    {profile.verified ? <VerifiedTick className="ml-2.5 text-[0.8em]" /> : null}
                  </h1>
                  <p className="mt-1.5 flex items-center gap-1.5 truncate text-[13.5px] font-medium text-[color:var(--slate)]">
                    <Icon name="pin" size={14} />
                    {profile.suburb ?? profile.city}
                    {" · "}
                    <span className="font-semibold text-[color:var(--purple)]">
                      been to {profile.attendedCount} event{profile.attendedCount === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
              </div>
              <ButtonLink href="/profile/edit" size="sm" className="shrink-0">
                Edit profile
              </ButtonLink>
            </header>

            <Rule />

            <Section label="Bio">
              <p className="text-[16px] leading-[1.6] text-[color:var(--ink)]">
                {profile.bio ?? "No bio yet - a line or two in your own words goes a long way."}
              </p>
            </Section>

            <Section label="Here for">
              {profile.intents.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.intents.map((intent) => (
                    <IntentChip key={intent}>{formatIntent(intent)}</IntentChip>
                  ))}
                </div>
              ) : (
                <Hint>
                  Nothing picked yet. Set what you&apos;re here for in{" "}
                  <EditLink>Edit profile</EditLink>.
                </Hint>
              )}
            </Section>

            <Section label="Into">
              {profile.interests.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((tag) => (
                    <Tag key={tag.slug}>{tag.label}</Tag>
                  ))}
                </div>
              ) : (
                <Hint>
                  No interest tags yet. Pick the things you&apos;re into in{" "}
                  <EditLink>Edit profile</EditLink>.
                </Hint>
              )}
            </Section>

            {profile.prompts.length > 0 ? (
              <Section label="In your words">
                <div className="grid gap-4">
                  {profile.prompts.map((prompt) => (
                    <div key={prompt.id}>
                      <p className="text-[12.5px] font-semibold text-[color:var(--slate)]">
                        {prompt.label}…
                      </p>
                      <p className="font-display mt-1 text-[length:var(--text-h3)] font-semibold leading-snug tracking-[-0.01em]">
                        {prompt.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            <Section label="Photos">
              {profile.galleryPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {profile.galleryPhotos.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="aspect-square w-full rounded-[12px] object-cover"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3.5 rounded-[16px] bg-[color:var(--lavender-100)] px-4 py-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--paper)] text-[color:var(--purple)]">
                    <Icon name="camera" size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold leading-snug text-[color:var(--ink)]">
                      Add a few photos so people can put a face to the name
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-[color:var(--slate)]">
                      A face helps people place you when you meet at an event.
                    </p>
                  </div>
                  <ButtonLink href="/profile/edit" size="sm" variant="secondary" className="shrink-0">
                    Add photos
                  </ButtonLink>
                </div>
              )}
            </Section>

            {/* Events - hairline-divided ROWS inside the card (no cards-in-cards) */}
            <div>
              <p className="eyebrow mb-3">Events you&apos;ve been to</p>
              {pastEvents.length > 0 ? (
                <div>
                  {pastEvents.map((event, i) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className={`flex items-center gap-3.5 py-3 transition-colors hover:bg-[color:var(--lavender-100)] ${
                        i ? "border-t border-[color:var(--mist)]" : ""
                      }`}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[color:var(--lavender-100)] text-[color:var(--purple-500)]">
                        <Icon name="calendar" size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-[color:var(--ink)]">
                          {event.title}
                        </span>
                        <span className="block truncate text-[12.5px] text-[color:var(--slate)]">
                          {event.date} · {event.suburb ?? event.location}
                        </span>
                      </span>
                      <span className="shrink-0">
                        <Badge tone="sage">Attended</Badge>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <Hint>
                  Nothing here yet. Once you&apos;ve been to something on Click it rests here -
                  book it again anytime.
                </Hint>
              )}
            </div>
          </article>

          <p className="mt-5 text-[13px] leading-6 text-[color:var(--slate)]">
            Choose what other members see - suburb, events attended and more - in{" "}
            <Link
              href="/account-settings?tab=privacy"
              className="font-semibold text-[color:var(--purple)] hover:underline"
            >
              Privacy &amp; visibility
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

/* Grouped by whitespace + one hairline - never a card inside a card. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="eyebrow mb-3">{label}</p>
      {children}
    </div>
  );
}

function Rule() {
  return <div className="my-6 h-px bg-[color:var(--mist)]" />;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-6 text-[color:var(--slate)]">{children}</p>;
}

function EditLink({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/profile/edit" className="font-semibold text-[color:var(--purple)] hover:underline">
      {children}
    </Link>
  );
}

/* Intent chip - the lavender-wash pill that ranks ABOVE the neutral interest
   tags. Never a status colour, never a filter button. */
function IntentChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] px-3 text-[13px] font-semibold leading-none text-[color:var(--ink)]">
      {children}
    </span>
  );
}
