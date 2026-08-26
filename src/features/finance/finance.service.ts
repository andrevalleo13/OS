export type FinanceTransaction = { amount: number; type: string };

export function calculateFinanceSummary(
  transactions: FinanceTransaction[],
  startingBalance = 4_200,
) {
  const spentThisWeek = transactions
    .filter((transaction) => transaction.type === "EXPENSE")
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  const incomeThisWeek = transactions
    .filter((transaction) => transaction.type === "INCOME")
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  return {
    spentThisWeek,
    incomeThisWeek,
    balance: startingBalance + incomeThisWeek - spentThisWeek,
  };
}
