import { BscWaitlistForm } from "@/components/bsc-action-forms";
import { SectionIntro } from "@/components/click-ui";

export const metadata = {
  title: "Waitlist | Bible Study Connect",
};

export default function WaitlistPage() {
  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <SectionIntro
          eyebrow="Waitlist"
          title="No suitable group yet? Help form one."
          body="Join a location-based waitlist. When three or more people share a location, the system suggests a match for admin review. Approval can automatically create a new group."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-5">
            <h2 className="font-display text-3xl font-light leading-tight">How matching works</h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              <p>Location, radius, availability, and hosting or leading willingness are stored.</p>
              <p>When at least three waiting members overlap in a location, a suggested match is created.</p>
              <p>Admins approve the suggested match before a group is created.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--champagne-deep)] p-5">
            <BscWaitlistForm />
          </div>
        </div>
      </section>
    </main>
  );
}
