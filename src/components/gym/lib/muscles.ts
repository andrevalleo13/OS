import { MUSCLE_DETAILS } from "@/components/gym/MuscleData";
import { fold } from "./text";

/**
 * Reglas ordenadas (la primera que coincide gana) para asignar un grupo
 * muscular de la taxonomía de `MUSCLE_DETAILS` a un ejercicio escrito libre,
 * en español o inglés.
 */
const RULES: [RegExp, string][] = [
  [/leg curl|curl femoral|femoral|isquio|hamstring|nordic/, "hamstrings"],
  [/peso muerto rumano|rumano|\brdl\b|romanian|stiff/, "hamstrings"],
  [/peso muerto|deadlift|lumbar|hiperextension|espalda baja/, "lower_back"],
  [/extension de triceps|triceps|tricep|press frances|pushdown|fondos|dips|skull/, "triceps"],
  [/predicador|curl|biceps|bicep|martillo|hammer/, "biceps"],
  [/extension de cuadriceps|extension cuadriceps|cuadriceps|sentadilla|squat|prensa|leg press|zancada|lunge|bulgar|hack/, "quads"],
  [/pantorrilla|gemelo|calf|calves|soleo/, "calves"],
  [/hip thrust|gluteo|glute|patada|abductor/, "glutes"],
  [/plancha|plank|pallof|crunch|abdomen|abdominal|\bcore\b|deadbug|dead bug|elevacion de piernas|levantamiento de piernas|rueda/, "abs"],
  [/face pull|militar|overhead|press de hombro|hombro|lateral|deltoide|arnold|pajaro|posterior/, "shoulders"],
  [/encogimiento|shrug|trapecio|espalda alta/, "traps"],
  [/jalon|pulldown|pull-?up|dominada|remo|\brow|dorsal|pullover|espalda/, "lats"],
  [/press inclinado|press banca|press plano|bench|peck|pec deck|fly|flyes|apertura|cruce|pecho|chest|press de pecho|chest press/, "chest"],
  [/antebrazo|muneca|farmer|forearm|grip/, "forearms"],
];

export function inferMuscleId(exercise: string): string | null {
  const text = fold(exercise);
  for (const [pattern, muscle] of RULES) if (pattern.test(text)) return muscle;
  return null;
}

/** Grupo muscular válido: el guardado si existe en la taxonomía, si no se infiere. */
export function resolveMuscleId(stored: string | null | undefined, exercise: string): string | null {
  if (stored && MUSCLE_DETAILS[stored]) return stored;
  return inferMuscleId(exercise);
}

export function muscleName(id: string | null): string {
  if (!id) return "Rendimiento";
  return MUSCLE_DETAILS[id]?.name ?? id;
}
