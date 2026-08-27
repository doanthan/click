import Link from "next/link";
import { AdminQaAccessControl } from "@/components/admin-qa-access-control";
import { Badge } from "@/components/ds";
import { QA_PERSONAS } from "@/lib/qa-personas";

/**
 * The admin's way into the QA persona switcher.
 *
 * The switcher lives in the signed-in avatar menu and is shown only to a
 * browser that has unlocked it. This section is the signpost and control for
 * that per-browser setting.
 *
 * The control posts to a server action that changes the HttpOnly unlock cookie
 * in place. It deliberately does not navigate: this page also owns editable
 * system settings, and enabling an independent testing tool must not trip their
 * leave-without-saving warning or discard their draft.
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
              ? `Open the testing workspace to start a scenario fresh, or use Test as another person in your avatar menu to keep existing progress. There are ${QA_PERSONAS.length} seeded customers, hosts, and an admin.${alwaysOn ? "" : " Access stays on for 12 hours."}`
              : `Adds the testing workspace and Test as another person to this browser. You can use ${QA_PERSONAS.length} seeded customers, hosts, and an admin without changing a real account.`}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
            The accounts and everything they create live in the{" "}
            <span className="font-semibold text-[color:var(--ink)]">@click.local</span> namespace, and
            the switcher can wipe them back to a clean slate. Real accounts are never touched.
          </p>
        </div>

        {alwaysOn ? (
          <Link href="/test" className="ck-btn ck-btn--primary ck-btn--md whitespace-nowrap">
            Open testing workspace
          </Link>
        ) : (
          <AdminQaAccessControl unlocked={unlocked} />
        )}
      </div>
    </section>
  );
}
