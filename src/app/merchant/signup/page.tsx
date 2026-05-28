import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MerchantSignupWizard } from "@/components/merchant-signup-wizard";
import {
  getMerchantCategoryOptions,
  getProfileStatus,
  listMerchantDocuments,
} from "@/lib/event-repository";

export const metadata = {
  title: "Become a host · 4-step signup | Click",
  description:
    "Set up your Click merchant profile in four steps: business details, contact & address, compliance documents, and review.",
};

// Step 0 (inline auth) lives INSIDE the wizard when no session exists, so we
// do NOT redirect logged-out users to /merchant/login here. That keeps the
// signup flow self-contained per the user's request.
export default async function MerchantSignupPage() {
  const session = await auth();

  if (session?.user) {
    const status = await getProfileStatus(session);
    if (status.merchantProfile) {
      redirect("/merchant");
    }
  }

  const [categories, existingDocs] = await Promise.all([
    getMerchantCategoryOptions(),
    session?.user ? listMerchantDocuments(session) : Promise.resolve([]),
  ]);

  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Become a host · 4-step signup
        </span>
        <h1 className="font-display mt-6 text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          Tell us about{" "}
          <span className="italic">who&apos;s hosting</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          Per spec §1 — business details, contact &amp; address, compliance documents, then review.
          Your application goes to admin review and unlocks the portal once approved.
        </p>

        <div className="mt-10">
          <MerchantSignupWizard
            isAuthed={!!session?.user}
            sessionEmail={session?.user?.email ?? ""}
            sessionName={session?.user?.name ?? ""}
            categories={categories}
            existingDocs={existingDocs.map((d) => ({
              documentType: d.document_type,
              fileName: d.file_name,
            }))}
            googleConfigured={googleConfigured}
            metaConfigured={metaConfigured}
          />
        </div>
      </section>
    </main>
  );
}
