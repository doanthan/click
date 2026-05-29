import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MerchantSignupProvider } from "@/components/merchant-signup-wizard";
import {
  getMerchantCategoryOptions,
  getProfileStatus,
  listMerchantDocuments,
} from "@/lib/event-repository";

export const metadata = {
  title: "Become a host | Click",
  description:
    "Set up your Click merchant profile: business details, contact & address, and compliance documents.",
};

// Shared chrome + state provider for the whole /merchant/signup flow. The
// provider is mounted here (not in each step page) so that wizard state
// survives client-side navigation between sibling step pages — App Router
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

  if (session?.user) {
    const status = await getProfileStatus(session);
    if (status.merchantProfile) {
      redirect("/merchant");
    }
  }

  // Provider data is only meaningful once authed. For the auth-gate page the
  // empty arrays are harmless — StepAuthCard doesn't consume the context.
  const [categories, existingDocs] = session?.user
    ? await Promise.all([
        getMerchantCategoryOptions(),
        listMerchantDocuments(session),
      ])
    : [[], []];

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 pb-12 pt-2 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Become a host
        </span>
        <h1 className="font-display mt-3 text-4xl font-light leading-[0.96] tracking-tight sm:text-5xl">
          Tell us about <span className="italic">you</span>.
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Your application goes to admin review and unlocks the portal once approved.
        </p>

        <div className="mt-5">
          <MerchantSignupProvider
            sessionEmail={session?.user?.email ?? ""}
            sessionName={session?.user?.name ?? ""}
            categories={categories}
            existingDocs={existingDocs.map((d) => ({
              documentType: d.document_type,
              fileName: d.file_name,
            }))}
          >
            {children}
          </MerchantSignupProvider>
        </div>
      </section>
    </main>
  );
}
