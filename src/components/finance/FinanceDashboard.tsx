"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { addTransaction, getTransactions } from "@/actions/finance";

type Transaction = { id: string; amount: number; type: string; category: string; note: string | null; date: string };
type FinanceData = { transactions: Transaction[]; balance: number; spentThisWeek: number; incomeThisWeek: number };

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export default function FinanceDashboard({ initialData }: { initialData: FinanceData }) {
  const [data, setData] = useState(initialData);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("intent") === "transaction") amountRef.current?.focus();
  }, []);

  const flow = data.incomeThisWeek - data.spentThisWeek;
  const maxMovement = useMemo(() => Math.max(...data.transactions.map((item) => Math.abs(item.amount)), 1), [data.transactions]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMessage("Ingresa un monto válido.");
      return;
    }
    setMessage("");
    startTransition(async () => {
      try {
        await addTransaction({ amount: kind === "expense" ? -parsed : parsed, category, note: note || undefined });
        const refreshed = await getTransactions();
        setData({ ...refreshed, transactions: refreshed.transactions.map((transaction) => ({ ...transaction, date: transaction.date.toISOString() })) });
        setAmount("");
        setNote("");
        setMessage("Movimiento registrado.");
      } catch {
        setMessage("No se pudo registrar. Inténtalo de nuevo.");
      }
    });
  };

  return (
    <main className="os-page mx-auto w-full max-w-[1400px] py-4 md:py-7">
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="os-surface rounded-[24px] p-5 sm:p-7">
          <div className="grid gap-6 sm:grid-cols-3">
            <FinanceMetric label="Disponible" value={currency.format(data.balance)} icon={<CircleDollarSign className="h-4 w-4" />} />
            <FinanceMetric label="Ingresos" value={currency.format(data.incomeThisWeek)} icon={<TrendingUp className="h-4 w-4" />} positive />
            <FinanceMetric label="Gastos" value={currency.format(data.spentThisWeek)} icon={<TrendingDown className="h-4 w-4" />} />
          </div>
          <div className="mt-7 border-t border-white/[0.06] pt-5">
            <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-medium text-white/75">Flujo neto</p><p className="mt-1 text-[10px] text-white/30">Ingresos menos gastos de esta semana</p></div><span className="text-lg font-medium text-white/70">{flow >= 0 ? "+" : ""}{currency.format(flow)}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.045]"><div className="h-full rounded-full bg-[color:var(--accent)] transition-[width]" style={{ width: `${Math.min(100, data.spentThisWeek / Math.max(data.incomeThisWeek, 5000) * 100)}%` }} /></div>
          </div>
        </div>

        <form onSubmit={submit} className="os-surface rounded-[24px] p-5 sm:p-7">
          <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Nuevo movimiento</p><p className="mt-1 text-[10px] text-white/30">Se refleja de inmediato en el sistema.</p></div><Plus className="h-4 w-4 text-[color:var(--accent)]" /></div>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-white/[0.025] p-1">
            {(["expense", "income"] as const).map((option) => <button key={option} type="button" onClick={() => setKind(option)} className={`h-9 rounded-lg text-[11px] transition active:scale-[0.98] ${kind === option ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}>{option === "expense" ? "Gasto" : "Ingreso"}</button>)}
          </div>
          <label className="mt-4 block"><span className="text-[10px] text-white/35">Monto</span><div className="mt-2 flex items-center rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 focus-within:border-[color:var(--accent)]/40"><span className="text-sm text-white/30">$</span><input ref={amountRef} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" className="h-11 w-full bg-transparent px-2 text-sm outline-none placeholder:text-white/15" /></div></label>
          <label className="mt-3 block"><span className="text-[10px] text-white/35">Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/[0.07] bg-[#121212] px-3 text-sm text-white/70 outline-none"><option>General</option><option>Comida</option><option>Transporte</option><option>Educación</option><option>Salud</option><option>Entretenimiento</option><option>Ingreso</option></select></label>
          <label className="mt-3 block"><span className="text-[10px] text-white/35">Nota opcional</span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Contexto del movimiento" className="mt-2 h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm outline-none placeholder:text-white/15" /></label>
          <button disabled={isPending} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#eeeeee] text-xs font-medium text-[#111111] transition hover:bg-white active:scale-[0.98] disabled:opacity-50">{isPending ? "Registrando…" : "Registrar movimiento"}<ArrowUpRight className="h-3.5 w-3.5" /></button>
          <p aria-live="polite" className="mt-2 min-h-4 text-[10px] text-white/35">{message}</p>
        </form>
      </section>

      <section className="mt-4 overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#0d0d0d]/80">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><h2 className="text-sm font-medium">Actividad reciente</h2><p className="mt-1 text-[10px] text-white/30">Últimos {data.transactions.length} movimientos</p></div></div>
        {data.transactions.length === 0 ? <p className="px-5 py-12 text-center text-xs text-white/30">Aún no hay movimientos. Registra el primero para activar el análisis.</p> : <div className="divide-y divide-white/[0.055]">{data.transactions.map((transaction) => <div key={transaction.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.035] text-white/35">{transaction.type === "INCOME" ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}</span><div className="min-w-0"><p className="truncate text-xs text-white/70">{transaction.category}</p><p className="mt-1 truncate text-[9px] text-white/25">{transaction.note || new Date(transaction.date).toLocaleDateString("es-MX")}</p><div className="mt-2 h-px max-w-sm overflow-hidden bg-white/[0.04]"><div className="h-full bg-white/15" style={{ width: `${Math.max(4, Math.abs(transaction.amount) / maxMovement * 100)}%` }} /></div></div><span className="font-mono text-[11px] text-white/55">{transaction.amount > 0 ? "+" : "−"}{currency.format(Math.abs(transaction.amount))}</span></div>)}</div>}
      </section>
    </main>
  );
}

function FinanceMetric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode; positive?: boolean }) {
  return <div><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] text-white/35">{icon}</div><p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">{label}</p><p className="mt-1 text-xl font-medium tracking-[-0.04em] text-white/80">{value}</p></div>;
}
