"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Check, Clock, MapPin, NotebookPen, Users } from "lucide-react";
import { useState } from "react";
import { formatDay, relativeDay, sentence, WEEK_ORDER, WEEKDAY_NAMES, weekdayOf } from "./lib/dates";
import type { DailyEntry, GymView } from "./lib/types";
import { KIND_ICON } from "./TodayHero";
import { cx, EASE, Empty, Eyebrow, NoteLink, noteHref, Panel, Segmented } from "./ui";

export function ProtocolPanel({ view }: { view: GymView }) {
  const todayWeekday = weekdayOf(view.todayKey);
  return (
    <Panel className="flex flex-col p-5 sm:p-6 lg:col-span-4">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Protocolo</Eyebrow>
        {view.routine.source && <NoteLink note={view.routine.source} />}
      </div>

      {view.protocol.length ? (
        <dl className="mt-4 flex flex-col gap-3">
          {view.protocol.map((line) => (
            <div key={`${line.source.path}-${line.label}`} className="group">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">{line.label}</dt>
              <dd className="mt-1 text-[12px] leading-relaxed text-white/70">{line.text}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 text-[11px] text-white/30">Sin reglas de protocolo en las notas de salud.</p>
      )}

      <div className="mt-6 border-t border-white/[0.05] pt-4">
        <Eyebrow className="text-[9px]">Semana tipo</Eyebrow>
        <ul className="mt-2">
          {WEEK_ORDER.map((weekday) => {
            const day = view.routine.days[weekday];
            const Icon = KIND_ICON[day.kind];
            const isToday = weekday === todayWeekday;
            return (
              <li key={weekday} className={cx("grid grid-cols-[34px_14px_1fr] items-center gap-2 rounded-md px-1.5 py-1.5 text-[11px]", isToday && "bg-white/[0.05]")}>
                <span className={cx("font-mono text-[10px]", isToday ? "text-white" : "text-white/35")}>{WEEKDAY_NAMES[weekday].slice(0, 3)}</span>
                <Icon className={cx("h-3 w-3", isToday ? "text-white/80" : "text-white/30")} />
                <span className={cx("truncate", isToday ? "text-white" : "text-white/55")}>
                  {day.name}
                  {day.focus && <span className="text-white/30"> · {day.focus}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function PartnerPanel({ view }: { view: GymView }) {
  const [main, ...others] = view.partners;
  return (
    <Panel className="flex flex-col p-5 sm:p-6 lg:col-span-4">
      <div className="flex items-center justify-between">
        <Eyebrow>Compañero de gym</Eyebrow>
        <Users className="h-3.5 w-3.5 text-white/25" />
      </div>
      {!main ? (
        <Empty icon={<Users className="h-4 w-4" />} title="Sin compañero detectado" hint="Menciona con quién entrenas en tus notas de salud y aparecerá aquí." className="flex-1" />
      ) : (
        <>
          <Link href={noteHref(main.path)} className="group mt-4 flex items-center gap-3.5 rounded-2xl p-2 -m-2 transition-colors hover:bg-white/[0.03]">
            <motion.span
              whileHover={{ scale: 1.06 }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.16),rgba(255,255,255,0.02))] font-mono text-[14px] text-white"
            >
              {initials(main.name)}
            </motion.span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium tracking-[-0.01em] text-white">{main.name}</span>
              <span className="block text-[10px] text-white/40">{main.relation ?? "Compañero"} · {main.score} menciones de gym</span>
            </span>
          </Link>
          {main.line && <p className="mt-4 border-l border-white/15 pl-3 text-[12px] leading-relaxed text-white/65">“{main.line}”</p>}
          {(view.schedule.time || view.schedule.place) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {view.schedule.time && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-[10px] text-white/60"><Clock className="h-3 w-3" />{view.schedule.time}</span>}
              {view.schedule.place && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-white/60"><MapPin className="h-3 w-3" />Gym {view.schedule.place}</span>}
            </div>
          )}
          {others.length > 0 && (
            <div className="mt-auto pt-5">
              <Eyebrow className="text-[9px]">También entrenan</Eyebrow>
              <ul className="mt-2 divide-y divide-white/[0.05]">
                {others.map((person) => (
                  <li key={person.path}>
                    <Link href={noteHref(person.path)} className="group flex items-start gap-3 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] font-mono text-[10px] text-white/60">{initials(person.name)}</span>
                      <span className="min-w-0">
                        <span className="block text-[12px] text-white/70 transition-colors group-hover:text-white">{person.name}</span>
                        {person.line && <span className="mt-0.5 block text-[10px] leading-relaxed text-white/35">{person.line}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function FlagChip({ entry }: { entry: DailyEntry }) {
  if (entry.gym === "si") return <span className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-black"><Check className="h-2.5 w-2.5" strokeWidth={3} />Gym</span>;
  if (entry.other) return <span className="rounded-full border border-white/20 px-1.5 py-0.5 text-[9px] text-white/60">{entry.other}</span>;
  if (entry.gym === "pendiente") return <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-white/40">Pendiente</span>;
  if (entry.gym === "no") return <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-white/35">Sin gym</span>;
  return null;
}

export function LogbookPanel({ view }: { view: GymView }) {
  const [tab, setTab] = useState<"diario" | "memoria">(view.body.length ? "diario" : "memoria");
  return (
    <Panel className="flex flex-col p-5 sm:p-6 lg:col-span-4">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Bitácora</Eyebrow>
        <Segmented layoutId="logbook-tab" value={tab} onChange={setTab} options={[{ value: "diario", label: "Cuerpo" }, { value: "memoria", label: "Memoria" }]} />
      </div>
      <div className="relative mt-4 max-h-[420px] flex-1 overflow-y-auto pr-1">
        {tab === "diario" ? (
          view.body.length ? (
            <ol className="flex flex-col gap-1">
              {view.body.map((entry, index) => (
                <motion.li key={entry.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.2, ease: EASE }}>
                  <Link href={noteHref(entry.path)} className="group block rounded-xl p-2.5 -mx-2.5 transition-colors hover:bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-white/70 group-hover:text-white">{sentence(formatDay(entry.key))} <span className="text-white/30">· {relativeDay(entry.key, view.todayKey)}</span></span>
                      <FlagChip entry={entry} />
                    </div>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {entry.body.slice(0, 3).map((line, lineIndex) => (
                        <li key={lineIndex} className="text-[11px] leading-relaxed text-white/45">
                          {line.label && <span className="text-white/65">{line.label}: </span>}
                          {line.text}
                        </li>
                      ))}
                    </ul>
                  </Link>
                </motion.li>
              ))}
            </ol>
          ) : (
            <Empty icon={<NotebookPen className="h-4 w-4" />} title="Sin entradas de cuerpo" hint="Llena la sección «Cuerpo» de tus notas diarias." />
          )
        ) : view.memory.length ? (
          <ol className="relative flex flex-col gap-4 border-l border-white/[0.07] pl-4">
            {view.memory.map((line, index) => (
              <motion.li key={`${line.key}-${index}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.2, ease: EASE }} className="relative">
                <span className="absolute -left-[19.5px] top-1.5 h-1.5 w-1.5 rounded-full bg-white/50 ring-4 ring-[#0d0d0d]" />
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-white/40">{line.key ? formatDay(line.key) : "Sin fecha"}</span>
                  <NoteLink note={line.source} />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-white/60">{line.text}</p>
              </motion.li>
            ))}
          </ol>
        ) : (
          <Empty icon={<BookOpen className="h-4 w-4" />} title="Sin memorias de entrenamiento" hint="Shadow agrega aquí lo que aprende de tu gym en las notas de salud." />
        )}
      </div>
    </Panel>
  );
}

export function VaultUnavailable() {
  return (
    <Panel className="lg:col-span-12">
      <Empty
        icon={<BookOpen className="h-4 w-4" />}
        title="Bóveda no disponible en este entorno"
        hint="Rutina, protocolo, compañero y bitácora se leen en vivo de Obsidian. Mientras tanto se usa la plantilla local y los datos de la base."
        className="py-12"
      />
    </Panel>
  );
}
