"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, LoaderCircle, X } from "lucide-react";
import type { LiveShadowStep } from "@/components/shadow/types";

/**
 * Lo que Shadow está haciendo de verdad, paso por paso. Cada paso entra al
 * empezar y se marca al terminar: el progreso visible sustituye a la espera
 * muda, que es lo que hace sentir lenta a una IA.
 */
export function ShadowSteps({ steps, className = "" }: { steps: LiveShadowStep[]; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  if (steps.length === 0) return null;
  return (
    <ol className={`flex flex-col gap-1.5 ${className}`} aria-live="polite">
      <AnimatePresence initial={false}>
        {steps.map((step) => (
          <motion.li
            key={step.id}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, x: -6, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
            className="flex items-center gap-2 font-mono text-[9px] tracking-[0.04em]"
          >
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
              {step.status === "running" ? (
                <LoaderCircle className="h-3 w-3 animate-spin text-white/45" />
              ) : step.status === "done" ? (
                <Check className="h-3 w-3 text-white/35" />
              ) : (
                <X className="h-3 w-3 text-white/35" />
              )}
            </span>
            <span className={`truncate transition-colors ${step.status === "running" ? "text-white/60" : "text-white/28"}`}>{step.label}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
