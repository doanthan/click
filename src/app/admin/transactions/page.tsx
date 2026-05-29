import { AdminTransactionsTable } from "@/components/admin-transactions-table";
import {
  listAdminConnectAccounts,
  listAdminPayouts,
  listAdminTransactions,
} from "@/lib/event-repository";

export const metadata = {
  title: "Transactions Management | Admin",
};

// ISO timestamps so the table's date filters can default to the last 30 days
// without re-rendering on every state change.
function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function AdminTransactionsPage() {
  const dateFrom = isoDaysAgo(30);
  const [transactions, payouts, connectAccounts] = await Promise.all([
    listAdminTransactions({ dateFrom, limit: 200 }),
    listAdminPayouts({ limit: 50 }),
    listAdminConnectAccounts(),
  ]);

  return (
    <div className="space-y-8 py-10">
      <AdminTransactionsTable
        initialTransactions={transactions}
        initialPayouts={payouts}
        connectAccounts={connectAccounts}
        defaultDateFrom={dateFrom}
      />
    </div>
  );
}
