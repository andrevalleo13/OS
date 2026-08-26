"use server";

import { revalidatePath } from "next/cache";
import { startOfWeek } from "date-fns";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateFinanceSummary } from "@/features/finance/finance.service";

const transactionSchema = z.object({
  amount: z.number().finite().refine((value) => value !== 0, "El monto no puede ser cero."),
  category: z.string().trim().min(1).max(100).default("Quick Expense"),
  note: z.string().trim().max(500).optional(),
  date: z.date().optional(),
});

export type AddTransactionInput = z.input<typeof transactionSchema>;

export async function getTransactions() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const [recentTransactions, weeklyTransactions] = await Promise.all([
    prisma.transaction.findMany({ orderBy: { date: "desc" }, take: 10 }),
    prisma.transaction.findMany({ where: { date: { gte: weekStart } } }),
  ]);
  return { transactions: recentTransactions, ...calculateFinanceSummary(weeklyTransactions) };
}

export async function addTransaction(input: AddTransactionInput) {
  const parsed = transactionSchema.parse(input);
  const amount = parsed.amount;
  const transaction = await prisma.transaction.create({
    data: {
      amount,
      type: amount > 0 ? "INCOME" : "EXPENSE",
      category: parsed.category,
      note: parsed.note ?? "Added via ValleOS",
      date: parsed.date,
    },
  });
  revalidatePath("/");
  revalidatePath("/finances");
  return transaction;
}
