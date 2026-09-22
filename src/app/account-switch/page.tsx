import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";
import { accountSwitchActor } from "@/lib/account-switch-policy";
import { searchSwitchAccounts } from "@/lib/admin-account-switch";
import { AccountSwitchForm, AccountSwitchButton } from "@/components/account-switch-form";
import { switchAdminAccount } from "./actions";

export const metadata = { title: "Switch account" };

export default async function AccountSwitchPage({ searchParams }: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!accountSwitchActor(session, isAdminEmail)) notFound();
  const { q = "" } = await searchParams;
  let accounts: Awaited<ReturnType<typeof searchSwitchAccounts>> = [];
  let unavailable = false;
  try { accounts = await searchSwitchAccounts(q); } catch { unavailable = true; }
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <Link href={session?.impersonation ? "/dashboard" : "/admin"} className="text-sm text-[color:var(--purple)]">← Back</Link>
      <p className="eyebrow mt-6">Admin tools</p>
      <h1 className="font-display mt-2 text-3xl font-semibold">Switch account</h1>
      <p className="mt-3 text-sm leading-6 text-[color:var(--slate)]">Open an existing account as that person. Changes you make affect their account. You can return to your admin account from the viewing banner.</p>
      <form className="my-6 flex gap-2" action="/account-switch">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search by name or email</span>
          <input name="q" type="search" defaultValue={q} placeholder="Search by name or email" maxLength={200}
            className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-3" />
        </label>
        <button className="ck-btn ck-btn--primary ck-btn--md">Search</button>
      </form>
      {unavailable ? <p role="alert">Account search is unavailable. Please refresh and try again.</p> : (
        <AccountSwitchForm action={switchAdminAccount}>
          <ul className="divide-y divide-[color:var(--line)] rounded-2xl bg-[color:var(--paper)] px-4">
            {accounts.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0 flex-1"><p className="font-semibold">{account.name}</p><p className="break-all text-sm text-[color:var(--slate)]">{account.email}</p><p className="text-xs capitalize text-[color:var(--slate)]">{account.role}</p></div>
                <AccountSwitchButton value={account.id} current={account.email.toLowerCase() === session?.user?.email?.toLowerCase()}>Switch to account</AccountSwitchButton>
              </li>
            ))}
          </ul>
          {!accounts.length ? <p className="py-6 text-sm">No accounts match this search.</p> : null}
          {accounts.length === 50 ? <p className="mt-3 text-sm text-[color:var(--slate)]">Showing the first 50 matches. Refine your search to find another account.</p> : null}
        </AccountSwitchForm>
      )}
    </main>
  );
}
