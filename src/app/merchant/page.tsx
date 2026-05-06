import { InfoCard, MetricCard, PageHero, Pill, SectionIntro } from "@/components/click-ui";
import { CreateEventForm } from "@/components/create-event-form";
import { EventCard } from "@/components/event-card";
import { clickEvents, merchantModules } from "@/lib/click-data";

export const metadata = {
  title: "Merchant Portal | Click",
  description: "Click merchant portal for event hosts, booking models, payments, and analytics.",
};

export default function MerchantPage() {
  const merchantEvents = clickEvents.filter((event) =>
    ["crossfit-coffee", "ordinary-creatives", "dog-park-cleanup"].includes(event.id),
  );

  return (
    <main className="min-h-screen bg-[#fffdf7] text-[#1f1f1f]">
      <PageHero
        eyebrow="Merchant portal"
        title="Hosts get autonomy, Click keeps the marketplace trustworthy."
        body="Merchants can create events, choose booking authority, manage attendees, and understand which tags convert into real participation."
      >
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Hosted events" value="12" tone="white" />
          <MetricCard label="Fill rate" value="83%" tone="aqua" />
          <MetricCard label="Revenue" value="$8.4k" tone="pink" />
          <MetricCard label="Pending" value="2" tone="white" />
        </div>
      </PageHero>

      <section className="bg-[#fffdf7] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Merchant workflow"
            title="Create, tag, price, submit, and learn."
            body="The portal turns event hosting into a structured workflow with admin review, schedule conflict checks, and audience analytics."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {merchantModules.map(([title, body], index) => (
              <InfoCard
                key={title}
                title={title}
                body={body}
                accent={index === 1 ? "pink" : "aqua"}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#d8f3ef] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.74fr_1.26fr]">
          <div>
            <SectionIntro
              eyebrow="Create event"
              title="The form should prevent bad inventory before review."
              body="Interest Tags are required, price and capacity define checkout behavior, and overlapping live events are blocked for the same merchant."
            />
            <div className="mt-8 flex flex-wrap gap-2">
              <Pill tone="pink">Stripe Connect</Pill>
              <Pill>External booking</Pill>
              <Pill tone="aqua">Conflict check</Pill>
            </div>
          </div>

          <CreateEventForm />
        </div>
      </section>

      <section className="bg-[#fffdf7] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Merchant events"
            title="Each card exposes booking certainty."
            body="Click-managed events can show payment, RSVP, and capacity truth. External events focus on discovery metrics."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {merchantEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-gradient-soft py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro
            eyebrow="Analytics"
            title="Discovery metrics and revenue should never be mixed up."
            body="External events report views, saves, clicks, and tag engagement. Click-managed events add revenue, confirmed RSVPs, refunds, and Stripe status."
            invert
          />
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <MetricCard label="Views" value="18.2k" tone="white" />
            <MetricCard label="Saves" value="1,284" tone="aqua" />
            <MetricCard label="RSVPs" value="612" tone="pink" />
            <MetricCard label="Refunds" value="14" tone="white" />
          </div>
        </div>
      </section>
    </main>
  );
}
