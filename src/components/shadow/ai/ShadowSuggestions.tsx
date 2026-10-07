"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const SPRING = { type: "spring", bounce: 0.1, duration: 0.3 } as const;
const STAGGER = 0.05;

export type ShadowSuggestion = {
  id: string;
  label: string;
  /** Etiqueta corta en mayúsculas, solo en la variante `cards`. */
  eyebrow?: string;
};

type Props = {
  suggestions: ShadowSuggestion[];
  onSelect: (suggestion: ShadowSuggestion) => void;
  variant?: "chips" | "cards";
  label?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Distancia al centro de la fila: el escalonado irradia desde el medio.
 * Un barrido de izquierda a derecha sugiere prioridad; estas opciones pesan
 * lo mismo y aparecer desde el centro lo comunica.
 */
const centreOut = (count: number) => {
  const middle = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => Math.abs(index - middle));
};

export function ShadowSuggestions({ suggestions, onSelect, variant = "chips", label, disabled = false, className = "" }: Props) {
  const reduced = useReducedMotion() ?? false;
  const delays = useMemo(() => centreOut(suggestions.length), [suggestions.length]);
  const cards = variant === "cards";

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      {label ? <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/20">{label}</p> : null}
      <ul className={cards ? "grid w-full gap-px overflow-hidden rounded-2xl border border-white/[0.055] bg-white/[0.055] sm:grid-cols-3" : "flex flex-wrap gap-1.5"}>
        <AnimatePresence initial>
          {suggestions.map((suggestion, index) => (
            <motion.li
              key={suggestion.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, scale: 0.94, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.94 }}
              transition={reduced ? { duration: 0 } : { ...SPRING, delay: (delays[index] ?? 0) * STAGGER }}
              className={cards ? "bg-[#0d0d0d]" : undefined}
            >
              <motion.button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(suggestion)}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                transition={SPRING}
                className={
                  cards
                    ? "group h-full w-full px-4 py-4 text-left transition-colors hover:bg-[#121212] disabled:opacity-40"
                    : "rounded-full border border-white/[0.06] bg-white/[0.015] px-3 py-1.5 text-left text-[10px] text-white/40 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white/75 disabled:opacity-40"
                }
              >
                {cards ? (
                  <>
                    {suggestion.eyebrow ? <span className="font-mono text-[8px] tracking-[0.16em] text-white/20">{suggestion.eyebrow}</span> : null}
                    <span className="mt-2 block text-[10px] leading-relaxed text-white/48 transition-colors group-hover:text-white/80">{suggestion.label}</span>
                  </>
                ) : (
                  suggestion.label
                )}
              </motion.button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
