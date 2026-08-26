import { getTransactions } from "@/actions/finance";
import FinanceDashboard from "@/components/finance/FinanceDashboard";

export default async function FinancesPage() {
  const summary = await getTransactions();
  return <FinanceDashboard initialData={{ ...summary, transactions: summary.transactions.map((transaction) => ({ ...transaction, date: transaction.date.toISOString() })) }} />;
}
