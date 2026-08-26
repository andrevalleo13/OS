"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ChevronRight, Footprints, HeartPulse, Moon, Scale } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { getBiometricOverview, logBiometrics } from "@/app/actions/biometrics";
import type { DashboardBiometrics } from "@/components/dashboard/types";
import { WidgetCard, useWidget } from "@/components/ui/widget";

export default function BiometricsWidget({ initialData }: { initialData: DashboardBiometrics }) {
  const [data, setData] = useState(initialData);
  const [form, setForm] = useState({ weight: "", sleep: "", hrv: "", steps: "" });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "biometrics";

  useEffect(() => setData(initialData), [initialData]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]));
    if (!Object.keys(payload).length) { setMessage("Agrega al menos una lectura."); return; }
    startTransition(async () => {
      try {
        await logBiometrics(payload);
        const refreshed = await getBiometricOverview();
        setData({ latest: refreshed.latest, averages: refreshed.averages, readiness: refreshed.readiness });
        setForm({ weight: "", sleep: "", hrv: "", steps: "" });
        setMessage("Lectura guardada.");
      } catch {
        setMessage("Revisa los valores e inténtalo otra vez.");
      }
    });
  };

  return (
    <WidgetCard id="biometrics" defaultClassName="min-h-[270px] md:col-span-3 xl:col-span-4" expandedClassName="min-h-[480px] md:col-span-6 xl:col-span-12" shrunkClassName="min-h-[180px] md:col-span-3 xl:col-span-4">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><Activity className="h-3.5 w-3.5 text-white/45" /><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Biometría</p><p className="mt-1 text-[10px] text-white/25">Estado de recuperación</p></div></div>
          <Link href="/biometrics" data-no-expand className="flex h-8 items-center gap-1 rounded-xl px-2.5 text-[10px] text-white/30 transition hover:bg-white/[0.045] hover:text-white/70 active:scale-[0.98]">Abrir <ChevronRight className="h-3 w-3" /></Link>
        </div>

        <div className="mt-6 grid grid-cols-[110px_1fr] items-center gap-5">
          <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full" style={{ background: `conic-gradient(rgba(255,255,255,.72) ${data.readiness}%, rgba(255,255,255,.055) 0)` }}>
            <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-[#0d0d0d]"><span className="text-3xl font-medium tracking-[-0.06em] text-white/80">{data.readiness}</span><span className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/22">Readiness</span></div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Metric icon={<Moon className="h-3 w-3" />} label="Sueño" value={data.latest.sleep === null ? "—" : `${data.latest.sleep.toFixed(1)}h`} />
            <Metric icon={<HeartPulse className="h-3 w-3" />} label="HRV" value={data.latest.hrv === null ? "—" : `${data.latest.hrv}ms`} />
            <Metric icon={<Footprints className="h-3 w-3" />} label="Pasos" value={data.latest.steps === null ? "—" : data.latest.steps.toLocaleString("es-MX")} />
            <Metric icon={<Scale className="h-3 w-3" />} label="Peso" value={data.latest.weight === null ? "—" : `${data.latest.weight.toFixed(1)}kg`} />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.form data-no-expand onSubmit={submit} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-6 border-t border-white/[0.055] pt-5">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Field label="Peso (kg)" value={form.weight} onChange={(weight) => setForm({ ...form, weight })} />
                <Field label="Sueño (h)" value={form.sleep} onChange={(sleep) => setForm({ ...form, sleep })} />
                <Field label="HRV (ms)" value={form.hrv} onChange={(hrv) => setForm({ ...form, hrv })} />
                <Field label="Pasos" value={form.steps} onChange={(steps) => setForm({ ...form, steps })} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3"><p aria-live="polite" className="text-[10px] text-white/35">{message}</p><button disabled={isPending} className="h-10 rounded-xl bg-white px-5 text-[10px] font-medium text-[#111] transition active:scale-[0.98] disabled:opacity-40">{isPending ? "Guardando…" : "Guardar lectura"}</button></div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </WidgetCard>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div><div className="flex items-center gap-1.5 text-white/25">{icon}<span className="font-mono text-[7px] uppercase tracking-wider">{label}</span></div><p className="mt-1 text-[13px] font-medium text-white/65">{value}</p></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[9px] text-white/30">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs outline-none" /></label>;
}
