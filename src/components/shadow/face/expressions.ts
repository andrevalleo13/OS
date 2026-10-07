import type { ShadowStatus } from "@/components/shadow/types";

/**
 * Un ojo es una cápsula. Cuatro números describen cualquier gesto:
 * alto, ancho, inclinación y desplazamiento vertical. Alto y estrecho es
 * neutral, bajo y ancho es contento, pequeño es sorpresa, inclinado hacia
 * dentro es enojo. Que cada ojo lleve valores distintos da guiños y dudas.
 */
export type EyeShape = {
  /** Multiplicador de la altura en reposo. `0` es un ojo cerrado. */
  h: number;
  /** Multiplicador del ancho en reposo. */
  w: number;
  /** Grados. Positivo baja la esquina interior (ceño). */
  rotate?: number;
  /** Desplazamiento vertical en unidades del viewBox. */
  dy?: number;
};

export type Expression = { left: EyeShape; right: EyeShape };

const eye = (h: number, w = 1, rotate = 0, dy = 0): EyeShape => ({ h, w, rotate, dy });

/** Misma inclinación en ambos ojos, en espejo. */
const both = (h: number, w = 1, rotate = 0, dy = 0): Expression => ({
  left: eye(h, w, rotate, dy),
  right: eye(h, w, -rotate, dy),
});

export const EXPRESSIONS = {
  neutral: both(1),
  alert: both(1.18, 1.08, 0, -1.5),
  focused: both(0.62, 1.08),
  doubtful: { left: eye(1, 1), right: eye(0.34, 1.3, -12, 1) },
  worried: both(0.82, 1, -12, -1),
  surprised: both(0.52, 0.62, 0, -3),
  sleepy: both(0.12, 1.3, 0, 3),
  wink: { left: eye(1, 1), right: eye(0.12, 1.25, 0, 2) },
  cross: both(0.8, 1, 16),
  /** Se dibuja como arcos felices; la forma es el respaldo sin movimiento. */
  happy: both(0.18, 1.3, 0, 2),
  /** Se dibuja como espirales; la forma es el respaldo sin movimiento. */
  dizzy: both(0.5, 0.9),
} satisfies Record<string, Expression>;

export type ExpressionName = keyof typeof EXPRESSIONS;

export const STATE_EXPRESSION: Record<ShadowStatus, ExpressionName> = {
  idle: "neutral",
  listening: "alert",
  thinking: "doubtful",
  speaking: "neutral",
  done: "happy",
  warning: "worried",
  error: "dizzy",
};

/** Traduce el `<mood>` que devuelve el modelo a un estado visible. */
export function statusFromMood(mood?: string | null): ShadowStatus {
  if (mood === "success") return "done";
  if (mood === "warning") return "warning";
  if (mood === "urgent") return "error";
  return "idle";
}
