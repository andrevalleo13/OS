import type { ShadowStatus } from "@/components/shadow/types";

/**
 * Única fuente de color del personaje (excepción documentada en
 * visual-policy.test.ts). Cada estado tiene su color. El cuerpo es un vidrio oscuro con un mármol
 * de color dentro; los ojos siempre son casi blancos para que la cara se lea
 * igual sobre cualquier fondo.
 */
export type FacePalette = {
  /** Fondo profundo del cuerpo. */
  core: string;
  /** Color principal del mármol. */
  mid: string;
  /** Destellos del mármol y borde. */
  light: string;
  /** Halo exterior y brillo de los ojos. */
  glow: string;
};

export const FACE_PALETTE: Record<ShadowStatus, FacePalette> = {
  // Grafito: presente, pero en calma.
  idle: { core: "#121212", mid: "#3a3a3a", light: "#c9c9c9", glow: "#9a9a9a" },
  // Hielo: atención abierta.
  listening: { core: "#04161d", mid: "#0ea5c6", light: "#a5f3fc", glow: "#22d3ee" },
  // Violeta: trabajo interno.
  thinking: { core: "#13072b", mid: "#7c3aed", light: "#d8b4fe", glow: "#a855f7" },
  // Naranja ValleOS: la voz de Shadow.
  speaking: { core: "#1c0800", mid: "#ff5500", light: "#ffc29e", glow: "#ff6a1f" },
  done: { core: "#03170f", mid: "#10b981", light: "#a7f3d0", glow: "#34d399" },
  warning: { core: "#1a1100", mid: "#f59e0b", light: "#fde68a", glow: "#fbbf24" },
  error: { core: "#1d0505", mid: "#e11d48", light: "#fecdd3", glow: "#f43f5e" },
};

/** Cómo se mueve el interior en cada estado. */
export type FaceMotion = {
  /** Grados por segundo del mármol. */
  spin: number;
  /** Amplitud de la respiración del cuerpo (escala). */
  breathe: number;
  /** Frecuencia de la respiración, en Hz. */
  breatheHz: number;
  /** Intensidad del halo, 0–1. */
  glow: number;
};

export const FACE_MOTION: Record<ShadowStatus, FaceMotion> = {
  idle: { spin: 9, breathe: 0.014, breatheHz: 0.22, glow: 0.35 },
  listening: { spin: 22, breathe: 0.03, breatheHz: 0.7, glow: 0.8 },
  thinking: { spin: 75, breathe: 0.008, breatheHz: 0.9, glow: 0.6 },
  speaking: { spin: 38, breathe: 0, breatheHz: 0, glow: 0.85 },
  done: { spin: 6, breathe: 0.012, breatheHz: 0.3, glow: 0.75 },
  warning: { spin: 14, breathe: 0.016, breatheHz: 0.5, glow: 0.6 },
  error: { spin: 0, breathe: 0.01, breatheHz: 1.4, glow: 0.5 },
};

/** Etiquetas en español para cualquier lugar que muestre el estado. */
export const STATUS_LABEL: Record<ShadowStatus, string> = {
  idle: "Disponible",
  listening: "Escuchando",
  thinking: "Pensando",
  speaking: "Respondiendo",
  done: "Listo",
  warning: "Atención",
  error: "Algo falló",
};
