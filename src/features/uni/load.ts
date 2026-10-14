import "server-only";

import { serverConfig } from "@/lib/config";
import { getVaultIndex, type IndexedNote } from "@/features/vault/index";
import { dailySettings } from "@/features/vault/ops";
import type { VaultUniInput } from "./derive";
import { contentLines, datedBullets, parseHqAlerts, parseScholarshipFacts, parseSemesterNote, parseTables } from "./parse";
import { addDays, fold, nameSimilarity } from "./text";

/**
 * Lee la bóveda en cada petición (vía el índice en memoria del motor de la
 * bóveda) y devuelve los hechos de la Universidad. Solo lectura.
 */

const DAILY_LOOKBACK_DAYS = 60;

function hasCalendarTable(note: IndexedNote): boolean {
  if (!/\|/.test(note.text)) return false;
  return parseTables(note.text).some((table) => {
    const headers = table.headers.map(fold);
    return headers.some((header) => /^materia|^asignatura/.test(header)) && headers.some((header) => /^fecha|^nota|^faltas/.test(header));
  });
}

function scoreSemesterNote(note: IndexedNote): number {
  const title = fold(note.title);
  const tags = note.parsed.tags.map(fold);
  let score = 0;
  if (/universidad|semestre|uni\b/.test(title)) score += 4;
  if (/semestre/.test(title)) score += 3;
  if (tags.some((tag) => /universidad|semestre/.test(tag))) score += 2;
  if (/^100\b|proyecto/.test(fold(note.path))) score += 1;
  if (score === 0) return 0;
  if (hasCalendarTable(note)) score += 10;
  return score;
}

export async function loadUniversityVault(today: string): Promise<{ vault: VaultUniInput | null; reason: string | null }> {
  if (!serverConfig.paths.vault) return { vault: null, reason: "La bóveda no está configurada en este entorno (OBSIDIAN_VAULT_PATH)." };
  try {
    const index = await getVaultIndex();
    const notes = [...index.notes.values()];

    const semesterNote = notes
      .map((note) => ({ note, score: scoreSemesterNote(note) }))
      .filter((item) => item.score >= 10)
      .sort((a, b) => b.score - a.score || b.note.mtime - a.note.mtime)[0]?.note ?? null;

    const hqNote = notes.find((note) => /^(000\s*-\s*)?hq\b/.test(fold(note.title)))
      ?? notes.find((note) => /semana de parciales/i.test(note.text) && note.path !== semesterNote?.path)
      ?? null;

    const settings = await dailySettings();
    const dailyFolder = settings.folder ? `${settings.folder}/` : "";
    const oldest = addDays(today, -DAILY_LOOKBACK_DAYS);
    const dailies = notes
      .filter((note) => note.path.startsWith(dailyFolder) && /^\d{4}-\d{2}-\d{2}$/.test(note.title))
      .filter((note) => note.title >= oldest && note.title <= today)
      .map((note) => ({ path: note.path, date: note.title, mtime: note.mtime, lines: contentLines(note.text) }));

    // Memorias fechadas ("- **[2026-10-12]** …") en las notas que hablan de la universidad.
    const universityNotes = notes.filter((note) => note !== semesterNote && !note.path.startsWith(dailyFolder) && !/personas\//i.test(note.path)
      && (/universidad|\bup\b/.test(fold(note.title)) || note === hqNote || note.parsed.tags.some((tag) => /universidad|education/.test(fold(tag)))));
    const memories = universityNotes.flatMap((note) => datedBullets(note.text)
      .filter((item) => item.date >= oldest)
      .map((item) => ({ path: note.path, date: item.date, text: item.text })));

    const scholarshipSources = [semesterNote, ...universityNotes, ...notes.filter((note) => /ficha|perfil/.test(fold(note.title)))]
      .filter((note): note is IndexedNote => Boolean(note));
    let threshold: number | null = null;
    let percent: number | null = null;
    for (const note of scholarshipSources) {
      if (!/beca/i.test(note.text)) continue;
      const facts = parseScholarshipFacts(note.text);
      threshold ??= facts.threshold;
      percent ??= facts.percent;
      if (threshold !== null && percent !== null) break;
    }

    const vault: VaultUniInput = {
      semester: semesterNote ? { path: semesterNote.path, mtime: semesterNote.mtime, facts: parseSemesterNote(semesterNote.text, { today, similarity: nameSimilarity }) } : null,
      hq: hqNote ? { path: hqNote.path, mtime: hqNote.mtime, alerts: parseHqAlerts(hqNote.text, { today }) } : null,
      dailies,
      memories,
      scholarship: { threshold, percent },
      notes: notes
        .filter((note) => !note.path.startsWith(dailyFolder) && note !== semesterNote && !/personas\//i.test(note.path))
        .map((note) => ({ path: note.path, title: note.title })),
    };
    return { vault, reason: semesterNote ? null : "No encontré una nota del semestre con tabla de materias en la bóveda." };
  } catch (error) {
    return { vault: null, reason: error instanceof Error ? `No pude leer la bóveda: ${error.message}` : "No pude leer la bóveda." };
  }
}
