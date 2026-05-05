import Image from "next/image";
import { AIMatchPanel } from "@/components/ai-match-panel";
import { InfoCard, LinkButton, MetricCard, SectionIntro } from "@/components/click-ui";
import { EventCard } from "@/components/event-card";
import {
  architectureLayers,
  clickEvents,
  groups,
  personaCards,
  roleCards,
} from "@/lib/click-data";

export default function Home() {
  return (
    <main className="min-h-screen max-w-full overflow-hidden bg-[#FFFCF9] text-[#340068]">
      <section className="brand-gradient fit-viewport relative overflow-hidden px-4 py-10 text-white sm:px-6 lg:py-14">
        <div className="paper-grid absolute inset-0 opacity-25" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mx-auto max-w-[320px] text-center text-xs font-black uppercase tracking-[0.18em] text-[#B1EDE8] sm:max-w-none sm:text-sm">
            AI people matching for Sydney
          </p>

          <div className="mt-4">
            <AIMatchPanel showEvents={false} />
          </div>

          <div className="mt-10 grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <h1 className="font-display text-5xl font-black leading-none sm:text-7xl">
                Common people, better reasons to meet.
              </h1>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href="/discover">Start matching</LinkButton>
                <LinkButton href="/events" variant="light">
                  Browse events
                </LinkButton>
              </div>
            </div>
            <p className="max-w-2xl text-base font-bold leading-7 text-white/70 lg:justify-self-end sm:text-lg">
              Click is not another swipe feed. It learns what feels hard to do alone,
              recommends people cards, and points everyone toward shared events,
              groups, and low-pressure rituals.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y-4 border-[#340068] bg-[#B1EDE8]">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:px-6 md:grid-cols-4">
          <MetricCard label="Connection modes" value="4" tone="white" />
          <MetricCard label="Tag systems" value="3" tone="white" />
          <MetricCard label="Refresh rhythm" value="4h" tone="white" />
          <MetricCard label="Primary outcome" value="Events" tone="pink" />
        </div>
      </section>

      <section className="bg-[#FFFCF9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Platform concept"
            title="Every journey leads toward a real shared plan."
            body="The product spec is now represented as pages: onboarding, discovery, events, dashboard, merchant tools, and admin operations."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {roleCards.map((role, index) => (
              <InfoCard
                key={role.title}
                eyebrow={role.eyebrow}
                title={role.title}
                body={role.body}
                accent={index === 1 ? "pink" : index === 2 ? "mauve" : "aqua"}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-gradient-soft py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Discovery model"
            title="Tags, personas, and events work as one system."
            body="Interest Tags drive event discovery. Life Quiz outputs shape context. Music Tags add subtle cultural affinity. Click Persona keeps the matching model human."
            invert
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {personaCards.map((persona) => (
              <article
                key={persona.title}
                className="rounded-lg border-2 border-white bg-[#FFFCF9] p-5 text-[#340068] shadow-[7px_7px_0_#6D435A]"
              >
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#340068]/45">
                  Click persona
                </p>
                <h3 className="mt-3 font-display text-3xl font-black leading-none">
                  {persona.title}
                </h3>
                <p className="mt-3 text-sm font-bold leading-6 text-[#340068]/65">
                  {persona.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FFFCF9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Featured events"
            title="The marketplace is designed around locked, waitlist, and unlocked states."
            body="Cards surface FOMO signals without exposing private identities, then guide users to RSVP, waitlist, or save."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {clickEvents.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FF6978] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#340068]">
              Groups for common people
            </p>
            <h2 className="mt-3 font-display text-5xl font-black leading-none text-[#340068] sm:text-6xl">
              Join once. Show up twice. Become familiar.
            </h2>
            <p className="mt-5 text-base font-bold leading-7 text-[#340068]/72">
              Click favors recurring groups because relationships rarely start in a
              single perfect moment. They start when ordinary people keep crossing
              paths.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <article
                key={group.name}
                className="rounded-lg border-2 border-[#340068] bg-[#FFFCF9] p-5 shadow-[6px_6px_0_#340068]"
              >
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#340068]/45">
                  {group.cadence}
                </p>
                <h3 className="mt-2 font-display text-3xl font-black leading-none">
                  {group.name}
                </h3>
                <p className="mt-2 text-sm font-black text-[#340068]/58">
                  {group.members} members - {group.category}
                </p>
                <p className="mt-3 text-sm font-bold leading-6 text-[#340068]/65">
                  {group.focus}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FFFCF9] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="relative min-h-[430px] overflow-hidden rounded-lg border-2 border-[#340068] shadow-[8px_8px_0_#340068]">
            <Image
              src="/media/networking.jpg"
              alt="People connecting at a local social event"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-[#FFFCF9]/94 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#340068]/50">
                Mutual Click outcome
              </p>
              <p className="mt-2 font-display text-3xl font-black leading-none text-[#340068]">
                You both love live jazz. Here is something nearby.
              </p>
            </div>
          </div>

          <div>
            <SectionIntro
              eyebrow="Architecture"
              title="A full product shell, ready for real services."
              body="The UI maps cleanly to Supabase Auth, RLS, Edge Functions, Stripe, Resend, Mapbox, and future push notification work."
            />
            <div className="mt-8 grid gap-4">
              {architectureLayers.map(([layer, body]) => (
                <InfoCard key={layer} title={layer} body={body} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
