import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MerchantSignupProvider } from "@/components/merchant-signup-wizard";
import {
  assertProfileStatusUsable,
  getMerchantCategoryOptions,
  getMerchantSignupPrefill,
  getProfileStatus,
  listMerchantDocuments,
} from "@/lib/event-repository";

export const metadata = {
  title: "Become a host",
  description:
    "Start hosting on Click in a minute: your name, a phone number and your venue.",
};

// Shared chrome + state provider for /merchant/signup. The signup is one page
// now (it was a three-step wizard, which is why the provider lives up here),
// and the layout still owns the data it needs and the "already a merchant"
// redirect. Unauthed visitors fall through to the `page.tsx` auth gate.
export default async function MerchantSignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  let isRejectedResubmit = false;
  if (session?.user) {
    const status = await getProfileStatus(session);
    assertProfileStatusUsable(status);
    // Approved/pending merchants belong in their portal - but a REJECTED merchant
    // must be let back into the wizard to edit + resubmit, otherwise the "Resubmit
    // application" CTA bounces straight back to /merchant (bug board #203/#204).
    if (status.merchantProfile && status.merchantProfile.verification_status !== "rejected") {
      redirect("/merchant");
    }
    isRejectedResubmit = status.merchantProfile?.verification_status === "rejected";
  }

  // Provider data is only meaningful once authed. For the auth-gate page the
  // empty arrays are harmless - StepAuthCard doesn't consume the context. A
  // rejected merchant resubmitting also gets their saved answers pre-filled
  // (bug board #203).
  const [categories, existingDocs, existingProfile] = session?.user
    ? await Promise.all([
        getMerchantCategoryOptions(),
        listMerchantDocuments(session),
        isRejectedResubmit ? getMerchantSignupPrefill(session) : Promise.resolve(null),
      ])
    : [[], [], null];

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 pb-12 pt-2 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <span className="eyebrow">Become a host</span>
        <h1 className="font-display mt-3 text-4xl font-semibold leading-tight tracking-[-0.025em] sm:text-5xl">
          Tell us about <span className="text-[color:var(--purple)]">you</span>.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--slate)]">
          {/* A rejected host resubmitting goes back to review; everyone else in
              the pilot is a host the moment they send this
              (registerMerchantWizardSubmit). */}
          {isRejectedResubmit
            ? "Your application goes back to admin review and unlocks the portal once approved."
            : "A few quick answers and you're in - build your first event straight away. Our team gives it a quick look before it goes live."}
        </p>

        <div className="mt-4 flex max-w-2xl items-start gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--lavender-100)] px-4 py-3 text-sm leading-6 text-[color:var(--ink)]">
          <span aria-hidden="true" className="mt-0.5 text-base leading-none text-[color:var(--purple)]">ⓘ</span>
          <span>
            {/* {" "} is load-bearing: JSX drops the leading space of the text node
                after </span>, so this rendered as "Sydneyfirst." in production. */}
            We&apos;re piloting in <span className="font-semibold">Sydney</span>{" "}
            first. Outside Sydney?
            Sign up anyway - we&apos;ll add you to the waitlist and email you when we launch in your city.
          </span>
        </div>

        <div className="mt-5">
          <MerchantSignupProvider
            sessionEmail={session?.user?.email ?? ""}
            sessionName={session?.user?.name ?? ""}
            categories={categories}
            existingDocs={existingDocs.map((d) => ({
              documentType: d.document_type,
              fileName: d.file_name,
            }))}
            existingProfile={existingProfile}
          >
            {children}
          </MerchantSignupProvider>
        </div>
      </section>
    </main>
  );
}
