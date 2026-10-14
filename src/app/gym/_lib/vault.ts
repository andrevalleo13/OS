import "server-only";

import { getVaultIndex, type IndexedNote, type VaultIndex } from "@/features/vault";
import { fold } from "@/components/gym/lib/text";
import type { DailyEntry, GymVaultSnapshot, LiftMention, MemoryLine, NoteRef, Partner } from "@/components/gym/lib/types";
import {
  datedLines,
  extractLiftMentions,
  extractMemory,
  isDailyNote,
  isFichaNote,
  isGymNote,
  mergeProtocol,
  noteRef,
  parseDaily,
  parseDefaultSets,
  parseFicha,
  parseMetricBullets,
  parseProtocol,
  parseRoutine,
  parseSchedule,
  parseWeeklyTarget,
  partnerScoreLine,
  pickPartnerLine,
  proteinTarget,
  type VaultNoteInput,
} from "@/components/gym/lib/vault-parse";

function toInput(note: IndexedNote): VaultNoteInput {
  return { path: note.path, title: note.title, text: note.text, frontmatter: note.parsed.frontmatter, tags: note.parsed.tags, mtime: note.mtime };
}

function isPersonNote(note: IndexedNote | undefined): boolean {
  if (!note) return false;
  return /(^|\/)personas\//.test(fold(note.path)) || fold(String(note.parsed.frontmatter.tipo ?? "")) === "persona";
}

/** Personas enlazadas desde líneas que hablan del gym, ordenadas por menciones. */
function findPartners(index: VaultIndex, notes: IndexedNote[]): Partner[] {
  const scores = new Map<string, number>();
  for (const note of notes) {
    const lines = note.text.split("\n");
    for (const link of index.outgoing.get(note.path) ?? []) {
      if (!link.resolved || !isPersonNote(index.notes.get(link.resolved))) continue;
      if (!partnerScoreLine(lines[link.line] ?? "")) continue;
      scores.set(link.resolved, (scores.get(link.resolved) ?? 0) + 1);
    }
  }
  // Una sola mención suele ser ruido (p. ej. una lista de amigos del fútbol).
  return [...scores.entries()]
    .filter(([, score]) => score >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([path, score]) => {
      const person = index.notes.get(path)!;
      const relation = person.parsed.frontmatter.relacion ?? person.parsed.frontmatter.relación;
      return {
        name: person.title.replace(/^Lore de\s+/i, ""),
        path,
        relation: typeof relation === "string" && relation.trim() ? relation.trim() : null,
        line: pickPartnerLine(person.text),
        score,
      };
    });
}

/**
 * Lee en vivo todo lo que la bóveda sabe del entrenamiento de André. Devuelve
 * null si la bóveda no está configurada o no se puede leer (p. ej. en Vercel).
 */
export async function readGymVault(): Promise<GymVaultSnapshot | null> {
  let index: VaultIndex;
  try {
    index = await getVaultIndex();
  } catch (error) {
    console.warn("[gym] Bóveda no disponible:", error instanceof Error ? error.message : error);
    return null;
  }

  const notes = [...index.notes.values()];
  const gymNotes = notes.filter((note) => isGymNote(toInput(note))).sort((a, b) => b.mtime - a.mtime);
  const ficha = notes.filter((note) => isFichaNote(toInput(note))).sort((a, b) => b.mtime - a.mtime)[0] ?? null;
  const dailyNotes = notes.filter((note) => isDailyNote(note));

  // Rutina: la nota de gym con el split más completo.
  let routine: GymVaultSnapshot["routine"] = null;
  for (const note of gymNotes) {
    const days = parseRoutine(note.text);
    if (days.length >= 2 && (!routine || days.length > routine.days.length)) routine = { source: noteRef(note), days };
  }
  const routineNote = routine ? gymNotes.find((note) => note.path === routine.source.path) ?? null : null;
  const orderedGymNotes = routineNote ? [routineNote, ...gymNotes.filter((note) => note !== routineNote)] : gymNotes;

  const protocol = mergeProtocol(orderedGymNotes.map((note) => parseProtocol(note.text).map((line) => ({ ...line, source: noteRef(note) }))));
  for (const note of orderedGymNotes) {
    const protein = proteinTarget(note.parsed.frontmatter);
    if (protein && !protocol.some((line) => /prote/.test(fold(line.label ?? "")))) {
      protocol.push({ label: "Proteína", text: `${protein} g diarios`, source: noteRef(note) });
    }
  }

  // Métricas: viñetas del protocolo primero, la ficha como respaldo.
  const metrics = { startWeight: null as number | null, height: null as number | null, goalWeight: null as number | null, goalNote: null as string | null };
  const measurementSources: NoteRef[] = [];
  for (const note of orderedGymNotes) {
    const parsed = parseMetricBullets(note.text);
    let used = false;
    for (const key of ["startWeight", "height", "goalWeight", "goalNote"] as const) {
      if (metrics[key] === null && parsed[key] !== null) {
        (metrics as Record<string, unknown>)[key] = parsed[key];
        used = true;
      }
    }
    if (used) measurementSources.push(noteRef(note));
  }
  const fichaData = ficha ? parseFicha(ficha.text) : { height: null, refWeight: null, traits: [] };
  if (ficha) measurementSources.push(noteRef(ficha));
  const fichaDate = ficha ? /(\d{4}-\d{2}-\d{2})/.exec(String(ficha.parsed.frontmatter.date ?? ""))?.[1] ?? null : null;

  const daily = dailyNotes.map((note) => parseDaily(toInput(note))).filter((entry): entry is DailyEntry => entry !== null);

  const exerciseNames = [...new Set((routine?.days ?? []).flatMap((day) => day.exercises.map((item) => item.name)))];
  const lifts: LiftMention[] = [];
  const memory: MemoryLine[] = [];
  for (const note of orderedGymNotes) {
    lifts.push(...extractLiftMentions(datedLines(note.text), exerciseNames, noteRef(note)));
    memory.push(...extractMemory(note.text, noteRef(note)));
  }
  for (const entry of daily) {
    lifts.push(...extractLiftMentions(entry.body.map((line) => ({ text: line.text, key: entry.key })), exerciseNames, { path: entry.path, title: entry.key }));
  }

  const partnerNotes = [...orderedGymNotes, ...(ficha ? [ficha] : [])];
  const partners = findPartners(index, partnerNotes);

  let schedule: GymVaultSnapshot["schedule"] = { time: null, place: null, source: null };
  for (const note of [...(ficha ? [ficha] : []), ...orderedGymNotes, ...partners.map((partner) => index.notes.get(partner.path)!).filter(Boolean)]) {
    const found = parseSchedule(note.text);
    if (found.time) {
      schedule = { ...found, source: noteRef(note) };
      break;
    }
  }

  let weeklyTarget: number | null = null;
  for (const note of [...orderedGymNotes, ...notes.filter((note) => /status board|hq/.test(fold(note.title)))]) {
    weeklyTarget = parseWeeklyTarget(note.text);
    if (weeklyTarget) break;
  }

  return {
    routine,
    protocol,
    defaultSets: parseDefaultSets(protocol),
    weeklyTarget,
    measurements: {
      height: metrics.height ?? fichaData.height,
      refWeight: fichaData.refWeight,
      refWeightKey: fichaDate,
      startWeight: metrics.startWeight,
      goalWeight: metrics.goalWeight,
      goalNote: metrics.goalNote,
      sources: measurementSources,
    },
    traits: ficha ? fichaData.traits.map((trait) => ({ ...trait, source: noteRef(ficha) })) : [],
    daily,
    lifts,
    memory,
    partners,
    schedule,
  };
}
