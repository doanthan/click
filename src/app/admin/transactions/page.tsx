export const metadata = {
  title: "Transactions Management | Admin",
};

export default function AdminTransactionsPage() {
  return (
    <div className="space-y-8 py-10">
      <ComingSoon
        label="Transactions Management"
        note="The transactions ledger UI is being wired up to the payment_transactions table. Charges, refunds, and payout status will land here."
      />
    </div>
  );
}

function ComingSoon({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] px-6 py-12 text-center hard-shadow-sm">
      <span className="sticker sticker--rose tilt-r-2 inline-flex">
        <span className="size-2 rounded-full bg-[color:var(--surface-deep)]" />
        Coming soon
      </span>
      <h3 className="font-display mt-5 text-3xl font-light leading-tight text-[color:var(--ink)]">
        {label}
      </h3>
      <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-6 text-[color:var(--mauve)]">
        {note}
      </p>
    </div>
  );
}
