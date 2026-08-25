import Link from "next/link";
import { Badge } from "@/components/ds";
import { QA_PERSONAS } from "@/lib/qa-personas";

/**
 * The admin's way into the QA persona switcher.
 *
 * The switcher lives in the signed-in avatar menu and is shown only to a
 * browser that has unlocked it. This section is the signpost and control for
 * that per-browser setting.
 *
 * Both buttons are plain links to /qa-unlock, which is a route handler: the
 * unlock is a cookie on the redirect response, and a Server Component cannot
 * set one.
 */
export function AdminQaAccess({
  unlocked,
  // Local dev unlocks the switcher for everyone with no cookie involved, so
  // there is nothing here to turn off - offering the button would be a lie that
  // does nothing when pressed.
  alwaysOn = false,
}: {
  unlocked: boolean;
  alwaysOn?: boolean;
}) {
  return (
    <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Testing</p>
          <h3 className="font-display mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
            Test accounts
            {unlocked ? (
              <Badge tone="lavender">{alwaysOn ? "On in local development" : "On for this browser"}</Badge>
            ) : null}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
            {unlocked
              ? `Open your avatar menu and choose Switch account. You can move between ${QA_PERSONAS.length} seeded accounts - hosts, customers and an admin - to walk a booking, payout or click from both sides.${alwaysOn ? "" : " Access stays on for 12 hours."}`
              : `Adds Switch account to your avatar menu on this browser. It signs you in as any of ${QA_PERSONAS.length} seeded accounts - hosts, customers and an admin - so you can test each side without signing out first.`}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
            The accounts and everything they create live in the{" "}
            <span className="font-semibold text-[color:var(--ink)]">@click.local</span> namespace, and
            the switcher can wipe them back to a clean slate. Real accounts are never touched.
          </p>
        </div>

        {alwaysOn ? null : unlocked ? (
          <Link href="/qa-unlock?lock=1&back=admin" className="ck-btn ck-btn--secondary ck-btn--md">
            Turn off
          </Link>
        ) : (
          <Link href="/qa-unlock?back=admin" className="ck-btn ck-btn--primary ck-btn--md">
            Turn on
          </Link>
        )}
      </div>
    </section>
  );
}
