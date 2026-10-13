import type { Metadata, ResolvingMetadata } from "next";
import { Logo } from "@/components/ds";
import { SiteFooter } from "@/components/site-chrome";
import { WaitlistForm } from "@/components/waitlist-form";
import { cleanReferralCode } from "@/lib/launch-waitlist";

/* /waitlist - the pre-launch Landing, STATE A of
   context/Click Design System/uploads/Click_Design_Prompt_Landing-dfcf27fc.md.
   A real dictionary entry for "click" and ONE action, "Request an invite".
   Essential elements only: no header (ChromeGate drops it - the headword IS
   the brand mark), no feature grid, no proof wall. Shared invite links land
   here as /i/<code> (a next.config redirect to ?ref=<code>). */

const DESCRIPTION =
  "Click is invite-only for now, opening first in Sydney's inner west and inner east. Request an invite.";

// A function, not a const, because openGraph and twitter REPLACE the root's
// rather than merging with it - and this page is the one that gets shared, so it
// must keep the root share image while it changes the title.
export async function generateMetadata(
  _props: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { openGraph, twitter } = await parent;
  const title = "Request an invite · Click";
  return {
    title: "Request an invite",
    description: DESCRIPTION,
    alternates: { canonical: "/waitlist" },
    openGraph: { title, description: DESCRIPTION, url: "/waitlist", images: openGraph?.images },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION, images: twitter?.images },
  };
}

/* Logo takes a px size, so each breakpoint gets its own copy and CSS shows one
   (the home page's headword does the same). The copies are aria-hidden; the
   sr-only word is what a screen reader hears. */
const HEADWORD_SIZES = [
  { size: 80, className: "inline-flex sm:hidden" },
  { size: 104, className: "hidden sm:inline-flex lg:hidden" },
  { size: 128, className: "hidden lg:inline-flex" },
] as const;

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await searchParams;
  const refCode = cleanReferralCode(Array.isArray(ref) ? ref[0] : ref);

  return (
    <>
      {/* On a desktop the entry sits in the middle of the space above the
          footer rather than leaving a dead band under it; on a phone it
          outgrows the screen anyway, so it starts at the top. */}
      <main className="ck-page flex flex-1 flex-col pt-[clamp(44px,9vh,112px)] pb-16 lg:justify-center lg:pb-[clamp(64px,9vh,112px)]">
        {/* minmax(0, ...) tracks: the share link on the success screen never
            wraps, and an auto track would grow to fit it - pushing the whole
            page wider than a phone. */}
        <div className="grid grid-cols-1 items-start gap-11 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-20">
          {/* The entry, set like a printed dictionary: headword, pronunciation
              and part of speech, a numbered sense, an italic example, a rule,
              then the positioning line. */}
          <div className="max-w-[580px]">
            <h1 className="rise-soft leading-none">
              <span className="sr-only">click</span>
              {HEADWORD_SIZES.map(({ size, className }) => (
                <span key={size} aria-hidden className={className}>
                  <Logo size={size} />
                </span>
              ))}
            </h1>
            <p className="rise-soft rise-d1 mt-4 text-base text-[color:var(--slate)] sm:text-[19px]">
              /klɪk/ · <i>verb</i>
            </p>
            <div className="rise-soft rise-d2 mt-5 flex gap-3 sm:gap-4">
              <span className="font-display flex-none text-[clamp(1.3125rem,1.05rem+1vw,1.75rem)] leading-[1.5] font-semibold text-[color:var(--purple-500)]">
                1.
              </span>
              <div>
                <p className="text-[clamp(1.3125rem,1.05rem+1vw,1.75rem)] leading-[1.5] text-pretty text-[color:var(--ink)]">
                  to connect effortlessly with someone through shared curiosity, energy, or
                  experience.
                </p>
                <p className="mt-3 text-base leading-[1.55] text-pretty text-[color:var(--slate)] italic sm:text-[17px]">
                  &ldquo;we met at pickleball and just clicked!&rdquo;
                </p>
              </div>
            </div>
            <hr className="draw-line rise-d3 mt-8 w-[110px] border-0 border-t border-[color:var(--mist-strong)]" />
            <p className="rise-soft rise-d4 font-display mt-6 max-w-[480px] text-[17px] leading-[1.45] font-medium text-balance text-[color:var(--ink)] sm:text-[20px]">
              We help people click in real life - not just online.
            </p>
          </div>

          {/* Level with the first line of the definition: headword (128) +
              pronunciation line + the sense's top margin. */}
          <div className="rise-soft rise-d5 lg:pt-[11.25rem]">
            <WaitlistForm refCode={refCode} />
          </div>
        </div>
      </main>
      {/* The global footer, drawn here because ChromeGate drops the chrome as
          one piece on this route - the canon keeps the footer on every page. */}
      <SiteFooter />
    </>
  );
}
