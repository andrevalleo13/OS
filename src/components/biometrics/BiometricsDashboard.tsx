"use client";

import { useState, useTransition } from "react";
import { Activity, Footprints, Gauge, HeartPulse, Moon, Plus, Scale } from "lucide-react";
import { getBiometricOverview, logBiometrics } from "@/app/actions/biometrics";

type Log = { id: string; date: string; weight: number | null; sleep: number | null; hrv: number | null; steps: number | null; calories: number | null };
type Overview = { logs: Log[]; latest: { weight: number | null; sleep: number | null; hrv: number | null; steps: number | null }; averages: { weight: number | null; sleep: number | null; hrv: number | null; steps: number | null }; readiness: number };

export default function BiometricsDashboard({ initialData }: { initialData: Overview }) {
  const [data, setData] = useState(initialData);
  const [form, setForm] = useState({ weight: "", sleep: "", hrv: "", steps: "" });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]));
    if (!Object.keys(payload).length) { setMessage("Agrega al menos una métrica."); return; }
    startTransition(async () => {
      try {
        await logBiometrics(payload);
        const refreshed = await getBiometricOverview();
        setData({ ...refreshed, logs: refreshed.logs.map((log) => ({ ...log, date: log.date.toISOString() })) });
        setForm({ weight: "", sleep: "", hrv: "", steps: "" });
        setMessage("Lectura guardada.");
      } catch { setMessage("Revisa los valores e inténtalo de nuevo."); }
    });
  };

  return (
    <main className="os-page mx-auto w-full max-w-[1400px] py-4 md:py-7">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Gauge className="h-4 w-4" />} label="Readiness" value={`${data.readiness}/100`} average="Estado actual" />
        <Metric icon={<Scale className="h-4 w-4" />} label="Peso" value={data.latest.weight === null ? "Sin dato" : `${data.latest.weight.toFixed(1)} kg`} average={data.averages.weight === null ? undefined : `Media ${data.averages.weight.toFixed(1)} kg`} />
        <Metric icon={<Moon className="h-4 w-4" />} label="Sueño" value={data.latest.sleep === null ? "Sin dato" : `${data.latest.sleep.toFixed(1)} h`} average={data.averages.sleep === null ? undefined : `Media ${data.averages.sleep.toFixed(1)} h`} />
        <Metric icon={<HeartPulse className="h-4 w-4" />} label="HRV" value={data.latest.hrv === null ? "Sin dato" : `${data.latest.hrv} ms`} average={data.averages.hrv === null ? undefined : `Media ${Math.round(data.averages.hrv)} ms`} />
        <Metric icon={<Footprints className="h-4 w-4" />} label="Pasos" value={data.latest.steps === null ? "Sin dato" : data.latest.steps.toLocaleString("es-MX")} average={data.averages.steps === null ? undefined : `Media ${Math.round(data.averages.steps).toLocaleString("es-MX")}`} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <form onSubmit={submit} className="os-surface rounded-[24px] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">Nueva lectura</p><p className="mt-1 text-[10px] text-white/30">Sólo llena las métricas disponibles.</p></div><Plus className="h-4 w-4 text-[color:var(--accent)]" /></div><div className="mt-5 grid grid-cols-2 gap-3"><Field label="Peso (kg)" value={form.weight} onChange={(weight) => setForm({ ...form, weight })} /><Field label="Sueño (h)" value={form.sleep} onChange={(sleep) => setForm({ ...form, sleep })} /><Field label="HRV (ms)" value={form.hrv} onChange={(hrv) => setForm({ ...form, hrv })} /><Field label="Pasos" value={form.steps} onChange={(steps) => setForm({ ...form, steps })} /></div><button disabled={isPending} className="mt-4 h-11 w-full rounded-xl bg-[#eeeeee] text-xs font-medium text-[#111111] transition active:scale-[0.98] disabled:opacity-50">{isPending ? "Guardando…" : "Guardar lectura"}</button><p aria-live="polite" className="mt-2 min-h-4 text-[10px] text-white/35">{message}</p></form>

        <div className="os-surface overflow-hidden rounded-[24px]"><div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4"><Activity className="h-4 w-4 text-[color:var(--accent)]" /><div><p className="text-sm font-medium">Historial de 30 días</p><p className="mt-1 text-[10px] text-white/30">Lecturas más recientes primero</p></div></div>{data.logs.length === 0 ? <div className="flex min-h-56 items-center justify-center text-xs text-white/25">Aún no hay lecturas biométricas.</div> : <div className="max-h-[420px] divide-y divide-white/[0.055] overflow-y-auto">{data.logs.map((log) => <div key={log.id} className="grid grid-cols-[1fr_repeat(4,minmax(0,0.65fr))] gap-2 px-5 py-3 text-[10px]"><span className="text-white/35">{new Date(log.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span><Cell value={log.weight === null ? "—" : `${log.weight} kg`} /><Cell value={log.sleep === null ? "—" : `${log.sleep} h`} /><Cell value={log.hrv === null ? "—" : `${log.hrv} ms`} /><Cell value={log.steps === null ? "—" : log.steps.toLocaleString("es-MX")} /></div>)}</div>}</div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value, average }: { icon: React.ReactNode; label: string; value: string; average?: string }) { return <div className="os-surface rounded-[22px] p-5"><div className="mb-5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] text-[color:var(--accent)]">{icon}</div><p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">{label}</p><p className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white/80">{value}</p><p className="mt-2 text-[9px] text-white/25">{average ?? "Registra datos para ver tendencia"}</p></div>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="text-[10px] text-white/35">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" className="mt-2 h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm outline-none" /></label>; }
function Cell({ value }: { value: string }) { return <span className="truncate text-right font-mono text-white/50">{value}</span>; }
