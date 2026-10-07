"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Un solo ciclo para todas las variantes: dos indicadores con tempos
 * distintos en la misma pantalla se leen como dos cosas sin relación.
 */
export const SHADOW_LOADER_CYCLE = 1.2;
const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;
/** Orden en diagonal, para que la rejilla se llene como un barrido. */
const GRID_DELAYS = [0, 1, 2, 1, 2, 3, 2, 3, 4];

export type ShadowLoaderVariant = "dots" | "bar" | "grid";

type Props = {
  variant?: ShadowLoaderVariant;
  label?: string;
  /** Contador vivo: las esperas largas necesitan una señal de avance. */
  showElapsed?: boolean;
  className?: string;
};

export function ShadowLoader({ variant = "dots", label, showElapsed = false, className = "" }: Props) {
  const reduced = useReducedMotion() ?? false;
  const pulse = (delay: number) =>
    reduced
      ? { duration: 0 }
      : { delay, duration: SHADOW_LOADER_CYCLE, ease: EASE_IN_OUT, repeat: Infinity };

  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35 ${className}`}>
      {label ? <span>{label}</span> : null}
      {variant === "dots" ? (
        <span className="flex items-center gap-[3px]">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-[3px] w-[3px] rounded-full bg-current"
              animate={reduced ? { opacity: 0.6 } : { opacity: [0.2, 1, 0.2] }}
              transition={pulse((index * SHADOW_LOADER_CYCLE) / 6)}
            />
          ))}
        </span>
      ) : null}
      {variant === "bar" ? (
        <span className="relative block h-px w-20 overflow-hidden rounded-full bg-white/[0.08]">
          {/* Un barrido, nunca un porcentaje: fingir progreso en una espera desconocida es mentir. */}
          <motion.span
            className="absolute inset-y-0 w-1/3 rounded-full bg-current"
            animate={reduced ? { x: "0%" } : { x: ["-100%", "300%"] }}
            transition={reduced ? { duration: 0 } : { duration: SHADOW_LOADER_CYCLE * 1.4, ease: EASE_IN_OUT, repeat: Infinity }}
          />
        </span>
      ) : null}
      {variant === "grid" ? (
        <span className="grid grid-cols-3 gap-[2px]">
          {GRID_DELAYS.map((delay, index) => (
            <motion.span
              key={index}
              className="h-[3px] w-[3px] rounded-[1px] bg-current"
              animate={reduced ? { opacity: 0.5 } : { opacity: [0.15, 1, 0.15] }}
              transition={pulse((delay * SHADOW_LOADER_CYCLE) / 8)}
            />
          ))}
        </span>
      ) : null}
      {showElapsed ? <Elapsed /> : null}
    </span>
  );
}

function Elapsed() {
  const [tenths, setTenths] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const interval = window.setInterval(() => setTenths(Math.floor((performance.now() - start) / 100)), 100);
    return () => window.clearInterval(interval);
  }, []);
  return <span className="tabular-nums text-white/22">{(tenths / 10).toFixed(1)}s</span>;
}
