"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTransactions() {
  try {
    const txs = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      take: 10,
    });
    
    // Calculate simple balance (Mocking a starting balance + incomes - expenses)
    // Real app would sum everything.
    const startBalance = 4200;
    const spentThisWeek = txs.filter((t: any) => t.type === 'EXPENSE').reduce((acc: number, t: any) => acc + t.amount, 0);
    const balance = startBalance - spentThisWeek;
    
    return { transactions: txs, balance, spentThisWeek };
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return { transactions: [], balance: 4200, spentThisWeek: 0 };
  }
}

export async function addTransaction(amount: number, category: string = "Quick Expense") {
  try {
    const tx = await prisma.transaction.create({
      data: {
        amount,
        type: amount > 0 ? "INCOME" : "EXPENSE",
        category,
        note: "Added via Shadow Quick Input",
      },
    });
    revalidatePath("/");
    return tx;
  } catch (error) {
    console.error("Failed to add transaction:", error);
    throw new Error("Failed to add transaction");
  }
}
