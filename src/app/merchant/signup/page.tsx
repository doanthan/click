import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MerchantSignupForm } from "@/components/merchant-signup-form";
import { getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Become a host | Click",
  description: "Set up a Click merchant profile to host events.",
};

export default async function MerchantSignupPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/merchant/signup");
  }

  const status = await getProfileStatus(session);

  if (status.merchantProfile) {
    redirect("/merchant");
  }

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.45fr_0.55fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Become a host
          </span>
          <h1 className="font-display mt-6 text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
            Tell us about <span className="italic">who&apos;s hosting</span>.
          </h1>
          <p className="mt-6 max-w-xl text-base font-medium leading-7 text-[color:var(--mauve)]">
            We need a few details for the listing and for admin review.
            Your event will go to pending status until admin approves the first one.
          </p>
          <ul className="mt-6 grid gap-2 text-sm font-semibold text-[color:var(--mauve)]">
            <li>✷ Business name appears on your event listings.</li>
            <li>✷ Contact email is for booking issues, not public.</li>
            <li>✷ ABN and website are optional but help approval.</li>
          </ul>
        </div>

        <MerchantSignupForm
          defaultContactEmail={session.user.email ?? ""}
          defaultBusinessName={session.user.name ? `${session.user.name}'s Events` : ""}
        />
      </div>
    </main>
  );
}
