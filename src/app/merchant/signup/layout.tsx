import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MerchantSignupProvider } from "@/components/merchant-signup-wizard";
import {
  getMerchantCategoryOptions,
  getMerchantSignupPrefill,
  getProfileStatus,
  listMerchantDocuments,
} from "@/lib/event-repository";

export const metadata = {
  title: "Become a host",
  description:
    "Set up your Click merchant profile: business details, contact & address, and compliance documents.",
};

// Shared chrome + state provider for the whole /merchant/signup flow. The
// provider is mounted here (not in each step page) so that wizard state
// survives client-side navigation between sibling step pages - App Router
// keeps layouts mounted across child page transitions, so the useReducer
// inside the provider doesn't unmount/reset when you go Business → Contact
// → Documents.
//
// The layout also handles the "already a merchant" redirect once, instead of
// repeating it in every step page. Unauthed visitors fall through to the
// `page.tsx` auth gate; per-step pages do their own session redirect to
// /merchant/signup if someone deep-links to /merchant/signup/business without
// being signed in.
export default async function MerchantSignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  let isRejectedResubmit = false;
  if (session?.user) {
    const status = await getProfileStatus(session);
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
          Your application goes to admin review and unlocks the portal once approved.
        </p>

        <div className="mt-4 flex max-w-2xl items-start gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--lavender-100)] px-4 py-3 text-sm leading-6 text-[color:var(--ink)]">
          <span aria-hidden="true" className="mt-0.5 text-base leading-none text-[color:var(--purple)]">ⓘ</span>
          <span>
            We&apos;re piloting in <span className="font-semibold">Sydney</span> first. Outside Sydney?
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
