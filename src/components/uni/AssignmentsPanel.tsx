"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { Check, Link2, ListChecks, LoaderCircle, Plus } from "lucide-react";
import { createAssignment, updateAssignmentStatus } from "@/app/actions/university";
import type { UniAssignment, UniOverview } from "@/features/uni/types";
import { addDaysKey, compactDays, daysBetween, grade, shortDate } from "./format";
import { cx, EASE, Panel, PanelHeader, PulseDot, Segmented, Tip } from "./primitives";

type Tab = "proximas" | "vencidas" | "hechas";

const inputClass = "h-9 w-full rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-3 text-[12px] text-white/85 outline-none transition placeholder:text-white/25 focus:border-white/25 focus:bg-white/[0.04]";

function NewAssignmentForm({ courses, today, onDone }: { courses: UniOverview["courses"]; today: string; onDone: () => void }) {
  const router = useRouter();
  const ids = { course: useId(), title: useId(), date: useId(), weight: useId() };
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(addDaysKey(today, 7));
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const current = courses.filter((course) => course.current);
  const others = courses.filter((course) => !course.current);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !courseId) {
      setError("Falta la materia o el título.");
      return;
    }
    const parsedWeight = weight.trim() === "" ? null : Number(weight);
    if (parsedWeight !== null && !(parsedWeight >= 0 && parsedWeight <= 100)) {
      setError("El peso va de 0 a 100.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await createAssignment({ courseId, title: title.trim(), dueDate, weight: parsedWeight });
        setTitle("");
        setWeight("");
        router.refresh();
        onDone();
      } catch {
        setError("No se pudo guardar. Revisa los datos.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-2.5 border-b border-white/[0.06] px-4 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_140px_84px_auto] sm:items-end sm:px-5">
      <label htmlFor={ids.course} className="flex flex-col gap-1.5">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/30">Materia</span>
        <select id={ids.course} value={courseId} onChange={(event) => setCourseId(event.target.value)} className={cx(inputClass, "appearance-none")}>
          {current.length > 0 && <optgroup label="Este semestre">{current.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</optgroup>}
          {others.length > 0 && <optgroup label="Otras">{others.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</optgroup>}
        </select>
      </label>
      <label htmlFor={ids.title} className="flex flex-col gap-1.5">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/30">Entrega</span>
        <input id={ids.title} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tarea 4, reporte, examen…" className={inputClass} autoFocus />
      </label>
      <label htmlFor={ids.date} className="flex flex-col gap-1.5">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/30">Fecha</span>
        <input id={ids.date} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={cx(inputClass, "font-mono [color-scheme:dark]")} />
      </label>
      <label htmlFor={ids.weight} className="flex flex-col gap-1.5">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/30">Peso %</span>
        <input id={ids.weight} value={weight} onChange={(event) => setWeight(event.target.value)} inputMode="decimal" placeholder="—" className={cx(inputClass, "font-mono")} />
      </label>
      <button type="submit" disabled={pending} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-[#eeeeee] px-4 text-[11.5px] font-medium text-[#111111] transition hover:bg-white active:scale-[0.98] disabled:opacity-50">
        {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Guardar
      </button>
      {error && <p aria-live="polite" className="text-[10.5px] text-white/60 sm:col-span-5">{error}</p>}
    </form>
  );
}

function AssignmentRow({ item, today, status, onToggle, busy }: { item: UniAssignment; today: string; status: UniAssignment["effectiveStatus"]; onToggle: () => void; busy: boolean }) {
  const done = status === "done";
  const days = daysBetween(today, item.dueDate);
  const lockedByVault = item.grade !== null && item.synced !== null;
  const isToday = !done && days === 0;
  const soon = !done && days > 0 && days <= 2;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 12, transition: { duration: 0.16 } }}
      transition={{ duration: 0.22, ease: EASE, layout: { duration: 0.25, ease: EASE } }}
      className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.04] px-4 py-2.5 last:border-b-0 sm:px-5"
    >
      <Tip content={lockedByVault ? `Calificado en la ${item.synced === "diario" ? "bitácora del diario" : "bóveda"}: ${grade(item.grade)}` : done ? "Marcar como pendiente" : "Marcar como hecha"}>
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${item.title} · ${item.course}`}
          disabled={lockedByVault || busy}
          onClick={onToggle}
          className={cx("flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border transition-all active:scale-90", done ? "border-white bg-white" : "border-white/20 hover:border-white/50", lockedByVault && "cursor-default opacity-70")}
        >
          <AnimatePresence>
            {done && (
              <motion.span initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }} transition={{ type: "spring", stiffness: 600, damping: 26 }}>
                <Check className="h-3 w-3 text-[#111111]" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </Tip>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {isToday && <PulseDot strong />}
          <span className={cx("truncate text-[12px]", done ? "text-white/40" : isToday || soon ? "text-white" : "text-white/80")}>{item.title}</span>
          {item.synced && (
            <Tip content={`Fecha${item.grade !== null ? " y calificación" : ""} tomadas de ${item.synced === "diario" ? "tu diario" : "la bóveda"}, más recientes que la base.`}>
              <Link2 tabIndex={0} className="h-3 w-3 shrink-0 text-white/30 outline-none" aria-label="Sincronizado con la bóveda" />
            </Tip>
          )}
        </div>
        <span className="mt-0.5 block truncate font-mono text-[9.5px] text-white/30">{item.course}{item.weight ? ` · vale ${Math.round(item.weight)}%` : ""}</span>
      </div>
      <div className="flex items-center gap-3 text-right">
        {item.grade !== null && <span className="font-mono text-[14px] leading-none text-white/85">{grade(item.grade)}</span>}
        <span className="flex flex-col items-end">
          <span className={cx("font-mono text-[10px]", isToday ? "text-white" : soon ? "text-white/75" : "text-white/40")}>{shortDate(item.dueDate)}</span>
          {!done && <span className="font-mono text-[9px] text-white/25">{compactDays(days)}</span>}
        </span>
      </div>
    </motion.li>
  );
}

export default function AssignmentsPanel({ overview, className }: { overview: UniOverview; className?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("proximas");
  const [showForm, setShowForm] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, UniAssignment["effectiveStatus"]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [, startTransition] = useTransition();
  const today = overview.today;

  useEffect(() => setOverrides({}), [overview.assignments]);

  const withStatus = useMemo(() => overview.assignments.map((item) => ({ item, status: overrides[item.id] ?? item.effectiveStatus })), [overview.assignments, overrides]);
  const groups = useMemo(() => ({
    proximas: withStatus.filter(({ item, status }) => status !== "done" && !item.archived && item.dueDate >= today),
    vencidas: withStatus.filter(({ item, status }) => status !== "done" && !item.archived && item.dueDate < today).reverse(),
    hechas: withStatus.filter(({ status }) => status === "done").reverse(),
  }), [withStatus, today]);
  const archived = withStatus.filter(({ item, status }) => status !== "done" && item.archived).length;

  const toggle = (item: UniAssignment, status: UniAssignment["effectiveStatus"]) => {
    const next = status === "done" ? "pending" : "done";
    setOverrides((current) => ({ ...current, [item.id]: next }));
    setBusyId(item.id);
    setMessage("");
    startTransition(async () => {
      try {
        await updateAssignmentStatus(item.id, next);
        router.refresh();
      } catch {
        setOverrides((current) => ({ ...current, [item.id]: status }));
        setMessage("No se pudo actualizar la entrega.");
      } finally {
        setBusyId(null);
      }
    });
  };

  const list = groups[tab];
  const canCreate = overview.db.available && overview.courses.length > 0;

  return (
    <Panel className={className}>
      <PanelHeader icon={<ListChecks />} title="Entregas">
        <div className="flex items-center gap-2">
          <Segmented
            layoutId="uni-assignment-tab"
            value={tab}
            onChange={setTab}
            options={[
              { value: "proximas", label: "Próximas", count: groups.proximas.length },
              { value: "vencidas", label: "Vencidas", count: groups.vencidas.length },
              { value: "hechas", label: "Hechas", count: groups.hechas.length },
            ]}
          />
          <Tip content={canCreate ? (showForm ? "Cerrar" : "Nueva entrega") : "La base de datos no está disponible."}>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => setShowForm((value) => !value)}
              aria-label={showForm ? "Cerrar formulario" : "Nueva entrega"}
              className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-white/[0.08] text-white/55 transition hover:border-white/25 hover:text-white active:scale-95 disabled:opacity-30"
            >
              <motion.span animate={{ rotate: showForm ? 45 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                <Plus className="h-3.5 w-3.5" />
              </motion.span>
            </button>
          </Tip>
        </div>
      </PanelHeader>

      <AnimatePresence initial={false}>
        {showForm && canCreate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.26, ease: EASE }, opacity: { duration: 0.16 } }} className="overflow-hidden">
            <NewAssignmentForm courses={overview.courses} today={today} onDone={() => { setShowForm(false); setTab("proximas"); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {!overview.db.available ? (
        <div className="px-5 py-10 text-center text-[11px] text-white/30">La base de datos no respondió. Las entregas vuelven cuando se reconecte.</div>
      ) : list.length === 0 ? (
        <div className="px-5 py-10 text-center text-[11px] text-white/30">
          {tab === "proximas" ? "Nada pendiente. Agrega una entrega con +." : tab === "vencidas" ? "Nada vencido." : "Aún no hay entregas hechas."}
        </div>
      ) : (
        <ul className="max-h-[440px] overflow-y-auto">
          <AnimatePresence initial={false} mode="popLayout">
            {list.map(({ item, status }) => (
              <AssignmentRow key={item.id} item={item} today={today} status={status} busy={busyId === item.id} onToggle={() => toggle(item, status)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] px-4 py-2.5 font-mono text-[9.5px] text-white/25 sm:px-5">
        <span>{archived > 0 ? `${archived} pendientes de semestres anteriores archivadas` : " "}</span>
        <span aria-live="polite" className="text-white/55">{message}</span>
      </div>
    </Panel>
  );
}
