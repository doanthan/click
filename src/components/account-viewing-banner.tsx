import Link from "next/link";
import { AccountSwitchForm, AccountSwitchButton } from "./account-switch-form";
import { switchAdminAccount } from "@/app/account-switch/actions";

export function AccountViewingBanner({ email, adminEmail, viewOnly }: { email: string; adminEmail: string; viewOnly: boolean }) {
  return (
    <aside aria-label="Viewing another account" className="border-b border-[color:var(--purple-800)] bg-[color:var(--purple)] text-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <div className="min-w-0">
          <p className="break-all text-sm font-semibold">Viewing as {email}{viewOnly ? " - view only" : ""}</p>
          <p className="text-xs opacity-80">
            {viewOnly ? "Nothing here can change this account." : "Changes affect this account."} Admin: {adminEmail}. Viewing access lasts up to one hour.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View only (HOTFIX 2026-10-12 H4.1): the proxy refuses every write
              from this session except on /account-switch, and this form would
              post to the page it sits on - so Return lives on that page. */}
          {viewOnly ? (
            <Link href="/account-switch" className="ck-btn ck-btn--secondary ck-btn--sm whitespace-nowrap">Return or switch account</Link>
          ) : (
            <>
              <Link href="/account-switch" className="text-sm font-semibold underline">Switch account</Link>
              <AccountSwitchForm action={switchAdminAccount}><AccountSwitchButton name="intent" value="return">Return to my admin account</AccountSwitchButton></AccountSwitchForm>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
