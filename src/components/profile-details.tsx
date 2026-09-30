import type { ReactNode } from "react";
import { formatIntent } from "@/lib/click-data";
import type { PublicProfile } from "@/lib/event-repository";
import { Avatar, Icon, Tag } from "./ds";
import { VerifiedTick } from "./verified-tick";

/**
 * What a viewer may see of someone else's profile. The owner's dating toggle is not
 * in it: `intents` arrives already gated on mutual dating opt-in (CLICK_LANGUAGE
 * v14), so the modal's payload can't carry a dating signal its viewer may not see.
 */
export type ProfileDetailsData = Omit<PublicProfile, "datingVisible">;

/**
 * A member's profile, read-only - the one body behind /profile/[userId] and the
 * profile modal a click surface opens (CHANGE BRIEF 2026-09-30 §2.4), so the two
 * can never show the same person two ways. No hooks: the page renders it on the
 * server and the modal on the client.
 *
 * Nothing here can send a click. Where the modal carries one, it is the card's own
 * control, handed in from outside (profile-modal.tsx).
 */
export function ProfileDetails({
  profile,
  titleAs: Title = "h1",
  titleId,
  headerAction,
}: {
  profile: ProfileDetailsData;
  // h1 on its own page; h2 inside the modal, over a page that has its own h1.
  titleAs?: "h1" | "h2";
  titleId?: string;
  // The owner's "Edit profile" on their own page.
  headerAction?: ReactNode;
}) {
  return (
    <>
      {/* Stacks below sm for the same reason the own-profile header does:
          at 375px the card's content box is 287px, the 72px avatar and its
          gap take 88px, and a nowrap action beside them leaves the name
          column ~70px - so a 28px display name spills out of the card. */}
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-[18px]">
          <Avatar name={profile.displayName} src={profile.photoUrl} size={72} ring />
          <div className="min-w-0">
            <Title
              id={titleId}
              className="font-display wrap-anywhere text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em]"
            >
              {profile.displayName}
              {profile.age ? ` · ${profile.age}` : ""}
              {profile.verified ? <VerifiedTick className="ml-2.5 text-[0.8em]" /> : null}
            </Title>
            <p className="mt-1.5 flex items-center gap-1.5 truncate text-[13.5px] font-medium text-[color:var(--slate)]">
              <Icon name="pin" size={14} />
              {profile.suburb ?? profile.city}
              {/* Hidden (null) or zero shows the location alone. Rendering
                  it unconditionally published "been to 0 events" for anyone
                  who turned the privacy toggle off, and for every genuine
                  newcomer - untrue, and deficit framing either way. */}
              {profile.attendedCount ? (
                <>
                  {" · "}
                  <span className="font-semibold text-[color:var(--purple)]">
                    been to {profile.attendedCount} event
                    {profile.attendedCount === 1 ? "" : "s"}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        {headerAction}
      </header>

      <Rule />

      <Section label="Bio">
        <p className="text-[16px] leading-[1.6] text-[color:var(--ink)]">
          {profile.bio ?? "No bio yet."}
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
          <Hint>Not specified.</Hint>
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
          <Hint>No interest tags yet.</Hint>
        )}
      </Section>

      {profile.prompts.length > 0 ? (
        <Section label="In their words">
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

      {profile.galleryPhotos.length > 0 ? (
        <div>
          <p className="eyebrow mb-3">Photos</p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {profile.galleryPhotos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`Photo of ${profile.displayName}`}
                className="aspect-square w-full rounded-[12px] object-cover"
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * The intents a viewer may see: "Open to dating" is mutual opt-in, so it shows only
 * when the owner has dating mode on AND the viewer is open to dating too. A
 * friends-only or signed-out viewer never sees a dating label.
 */
export function visibleIntentsFor(
  profile: Pick<PublicProfile, "intents" | "datingVisible">,
  viewerOpenToDating: boolean,
): string[] {
  return profile.intents.filter(
    (intent) => intent !== "dating" || (profile.datingVisible && viewerOpenToDating),
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
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

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[14px] leading-6 text-[color:var(--slate)]">{children}</p>;
}

function IntentChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-[color:var(--lavender)] bg-[color:var(--lav-bg)] px-3 text-[13px] font-semibold leading-none text-[color:var(--ink)]">
      {children}
    </span>
  );
}
