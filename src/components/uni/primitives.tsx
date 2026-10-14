"use client";

import { animate, AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Curva común: arranque rápido, frenado suave (Apple/Linear). */
export const EASE = [0.16, 1, 0.3, 1] as const;
export const SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

export const rise: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/** Etiqueta mínima en mayúsculas y monoespaciada. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono text-[9px] uppercase tracking-[0.18em] text-white/35", className)}>{children}</span>;
}

export function Panel({ children, className, as = "section", id }: { children: ReactNode; className?: string; as?: "section" | "div" | "aside"; id?: string }) {
  const Component = as === "aside" ? motion.aside : as === "div" ? motion.div : motion.section;
  return (
    <Component id={id} variants={rise} className={cx("os-surface relative rounded-[20px]", className)}>
      {children}
    </Component>
  );
}

export function PanelHeader({ icon, title, meta, children }: { icon?: ReactNode; title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/[0.06] px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-white/35 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
        <Label className="text-white/50">{title}</Label>
        {meta && <span className="truncate font-mono text-[10px] text-white/30">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-white/[0.1] bg-white/[0.03] px-1 font-mono text-[9px] leading-none text-white/45">
      {children}
    </kbd>
  );
}

/** Punto con pulso suave para "hoy" / "en vivo". El pulso se apaga con movimiento reducido. */
export function PulseDot({ className, strong = false }: { className?: string; strong?: boolean }) {
  return (
    <span className={cx("relative inline-flex h-1.5 w-1.5 shrink-0", className)} aria-hidden>
      <span className={cx("absolute inset-0 rounded-full bg-white motion-safe:animate-ping", strong ? "opacity-60" : "opacity-35")} />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
    </span>
  );
}

/** Número que cuenta hasta su valor al montarse o cambiar. */
export function Ticker({ value, decimals = 1, className, duration = 0.9, prefix = "" }: { value: number | null; decimals?: number; className?: string; duration?: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const reduced = useReducedMotion();
  const format = useCallback((input: number) => `${prefix}${input.toFixed(decimals)}`, [decimals, prefix]);

  useEffect(() => {
    const node = ref.current;
    if (!node || value === null) return;
    if (reduced) {
      node.textContent = format(value);
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration,
      ease: EASE,
      onUpdate: (latest) => {
        node.textContent = format(latest);
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduced, duration, format]);

  if (value === null) return <span className={className}>—</span>;
  return <span ref={ref} className={className}>{format(0)}</span>;
}

/**
 * Tooltip en portal: no lo recortan los contenedores con scroll. Aparece con
 * hover y con foco de teclado (nunca es la única vía para leer un dato).
 */
export function Tip({ content, children, className, side = "top" }: { content: ReactNode; children: ReactNode; className?: string; side?: "top" | "bottom" }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number; side: "top" | "bottom" } | null>(null);
  const [mounted, setMounted] = useState(false);
  const id = useId();

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const flip = side === "top" && rect.top < 72;
    setPosition({ x: rect.left + rect.width / 2, y: flip || side === "bottom" ? rect.bottom + 8 : rect.top - 8, side: flip ? "bottom" : side });
  }, [open, side]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span
      ref={anchor}
      className={cx("inline-flex", className)}
      onPointerEnter={(event) => event.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {open && position && (
            <motion.span
              id={id}
              role="tooltip"
              initial={{ opacity: 0, y: position.side === "top" ? 4 : -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: EASE }}
              style={{ left: position.x, top: position.y }}
              className={cx(
                "pointer-events-none fixed z-[200] w-max max-w-[260px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0a0a0a]/95 px-3 py-2 text-[11px] leading-snug text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-3xl",
                position.side === "top" && "-translate-y-full",
              )}
            >
              {content}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}

/** Fila de tooltip: el valor manda, la etiqueta acompaña. */
export function TipRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="flex items-baseline justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className="font-mono text-white/90">{value}</span>
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, layoutId }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (value: T) => void; layoutId: string }) {
  return (
    <div className="flex items-center gap-0.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-0.5" role="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cx("relative h-6 rounded-[8px] px-2.5 text-[10px] transition-colors active:scale-[0.97]", active ? "text-white" : "text-white/40 hover:text-white/70")}
          >
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-[8px] border border-white/[0.08] bg-white/[0.07]" transition={SPRING} />}
            <span className="relative flex items-center gap-1.5">
              {option.label}
              {option.count !== undefined && <span className={cx("font-mono text-[9px]", active ? "text-white/55" : "text-white/25")}>{option.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Medidor de faltas por celdas; admite medias faltas. */
export function AbsenceMeter({ used, limit, emphasis, className }: { used: number | null; limit: number; emphasis: boolean; className?: string }) {
  const cells = Math.max(1, Math.round(limit));
  return (
    <span className={cx("flex gap-[3px]", className)} aria-label={used === null ? "Sin datos de faltas" : `${used} de ${limit} faltas`}>
      {Array.from({ length: cells }, (_, index) => {
        const fill = used === null ? 0 : Math.max(0, Math.min(1, used - index));
        return (
          <span key={index} className="relative h-[6px] flex-1 overflow-hidden rounded-[2px] bg-white/[0.07]">
            <motion.span
              className={cx("absolute inset-y-0 left-0 rounded-[2px]", emphasis ? "bg-white/90" : "bg-white/40")}
              initial={{ width: 0 }}
              animate={{ width: `${fill * 100}%` }}
              transition={{ duration: 0.5, delay: 0.15 + index * 0.04, ease: EASE }}
            />
          </span>
        );
      })}
    </span>
  );
}

/** Reloj del cliente que arranca en el instante del servidor (sin desajuste de hidratación). */
export function useNow(initialIso: string, intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.parse(initialIso));
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Estado por visitante en localStorage, tolerante a modos privados. */
export function useLocalSet(key: string): [Set<string>, (item: string) => void] {
  const [items, setItems] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setItems(new Set(JSON.parse(raw) as string[]));
    } catch {
      // Sin almacenamiento: la lista vive solo en memoria.
    }
  }, [key]);
  const toggle = useCallback((item: string) => {
    setItems((current) => {
      const next = new Set(current);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      try {
        window.localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        // Ignorado a propósito.
      }
      return next;
    });
  }, [key]);
  return [items, toggle];
}
