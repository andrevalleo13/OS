"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CircleDollarSign } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { addTransaction, getTransactions } from "@/actions/finance";
import type { DashboardFinance } from "@/components/dashboard/types";
import { WidgetCard, useWidget } from "@/components/ui/widget";
import { useDashboardShortcut } from "@/hooks/useDashboardShortcut";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export default function FinanceWidget({ initialData }: { initialData: DashboardFinance }) {
  const [data, setData] = useState(initialData);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);
  const { activeWidgetId, setActiveWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "finance";
  const netFlow = data.incomeThisWeek - data.spentThisWeek;
  const spendingRatio = Math.min(100, data.spentThisWeek / Math.max(data.incomeThisWeek, 5_000) * 100);

  useEffect(() => setData(initialData), [initialData]);

  useDashboardShortcut("e", () => {
    setActiveWidgetId("finance");
    window.setTimeout(() => amountRef.current?.focus(), 120);
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) { setMessage("Ingresa un monto válido."); return; }
    setMessage("");
    startTransition(async () => {
      try {
        await addTransaction({ amount: -parsed, category, note: "Registrado desde el centro de mando" });
        const refreshed = await getTransactions();
        setData({ ...refreshed, transactions: refreshed.transactions.map((transaction) => ({ ...transaction, date: transaction.date.toISOString() })) });
        setAmount("");
        setMessage("Gasto registrado.");
      } catch {
        setMessage("No se pudo registrar el gasto.");
      }
    });
  };

  return (
    <WidgetCard id="finance" defaultClassName="min-h-[270px] md:col-span-3 xl:col-span-4" expandedClassName="min-h-[480px] md:col-span-6 xl:col-span-12" shrunkClassName="min-h-[180px] md:col-span-3 xl:col-span-4">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><CircleDollarSign className="h-3.5 w-3.5 text-white/45" /><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Finanzas</p><p className="mt-1 text-[10px] text-white/25">Flujo de esta semana</p></div></div>
          <Link href="/finances" data-no-expand className="flex h-8 items-center gap-1 rounded-xl px-2.5 text-[10px] text-white/30 transition hover:bg-white/[0.045] hover:text-white/70 active:scale-[0.98]">Abrir <ChevronRight className="h-3 w-3" /></Link>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto] items-end gap-4">
          <div><p className="text-3xl font-medium tracking-[-0.055em] text-white/85">{currency.format(data.balance)}</p><p className="mt-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">Disponible</p></div>
          <div className="text-right"><p className={`font-mono text-[11px] ${netFlow >= 0 ? "text-white/60" : "text-white/35"}`}>{netFlow >= 0 ? "+" : "−"}{currency.format(Math.abs(netFlow))}</p><p className="mt-1 text-[9px] text-white/20">flujo neto</p></div>
        </div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.045]"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: spendingRatio / 100 }} style={{ transformOrigin: "left" }} className="h-full w-full rounded-full bg-white/45" /></div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-5 flex-1 border-t border-white/[0.055] pt-4">
              <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">Actividad reciente</p>
              {data.transactions.length === 0 ? <div className="flex min-h-28 items-center justify-center text-xs text-white/25">Todavía no hay movimientos.</div> : (
                <div className="max-h-48 divide-y divide-white/[0.05] overflow-y-auto">
                  {data.transactions.slice(0, 6).map((transaction) => (
                    <div key={transaction.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.035] text-white/30">{transaction.amount > 0 ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}</span>
                      <div className="min-w-0"><p className="truncate text-[11px] text-white/60">{transaction.category}</p><p className="mt-0.5 truncate text-[9px] text-white/20">{transaction.note || new Date(transaction.date).toLocaleDateString("es-MX")}</p></div>
                      <span className="font-mono text-[10px] text-white/45">{transaction.amount > 0 ? "+" : "−"}{currency.format(Math.abs(transaction.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <form data-no-expand onSubmit={submit} className="mt-5" aria-label="Registrar gasto rápido">
          <div className="grid grid-cols-[1fr_108px_auto] gap-2">
            <label className="sr-only" htmlFor="quick-expense">Monto</label>
            <div className="flex h-10 items-center rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 focus-within:border-white/[0.16]"><span className="text-xs text-white/25">$</span><input id="quick-expense" ref={amountRef} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Gasto rápido" className="h-full min-w-0 flex-1 bg-transparent px-2 text-xs outline-none placeholder:text-white/20" /></div>
            <label className="sr-only" htmlFor="quick-expense-category">Categoría</label>
            <select id="quick-expense-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-xl border border-white/[0.07] bg-[#121212] px-2 text-[10px] text-white/50 outline-none"><option>General</option><option>Comida</option><option>Transporte</option><option>Educación</option><option>Salud</option><option>Entretenimiento</option></select>
            <button disabled={isPending || !amount} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#111] transition active:scale-[0.96] disabled:opacity-25" aria-label="Registrar gasto"><ArrowUpRight className="h-3.5 w-3.5" /></button>
          </div>
          <p aria-live="polite" className="mt-2 min-h-4 text-[9px] text-white/30">{isPending ? "Registrando…" : message}</p>
        </form>
      </div>
    </WidgetCard>
  );
}
