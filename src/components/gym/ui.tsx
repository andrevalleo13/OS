"use client";

import Link from "next/link";
import { animate, motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useUIStore } from "@/store/useUIStore";
import { daysBetween, formatShort } from "./lib/dates";
import type { NoteRef, SeriesPoint } from "./lib/types";

export const EASE = [0.16, 1, 0.3, 1] as const;

export const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

export const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;

export function usePrefersReducedMotion(): boolean {
  const system = useReducedMotion();
  const app = useUIStore((state) => state.reducedMotion);
  return Boolean(system || app);
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function noteHref(path: string): string {
  return `/obsidian?note=${encodeURIComponent(path)}`;
}

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------

export function Panel({ children, className, as = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  const Component = as === "div" ? motion.div : as === "article" ? motion.article : motion.section;
  return (
    <Component variants={itemVariants} className={cx("os-surface relative min-w-0 rounded-[20px]", className)}>
      {children}
    </Component>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("font-mono text-[10px] uppercase tracking-[0.16em] text-white/38", className)}>{children}</p>;
}

export function SectionRule({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <motion.div variants={itemVariants} className="mb-3 mt-9 flex items-center gap-3 first:mt-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">{label}</span>
      <span className="h-px flex-1 bg-white/[0.07]" />
      {right}
    </motion.div>
  );
}

export function Kbd({ children, tone = "dark", className }: { children: ReactNode; tone?: "dark" | "light"; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border px-1 font-mono text-[10px] leading-none",
        tone === "light" ? "border-black/15 bg-black/[0.04] text-black/55" : "border-white/[0.12] bg-white/[0.04] text-white/50",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function NoteLink({ note, children, className }: { note: NoteRef; children?: ReactNode; className?: string }) {
  return (
    <Link
      href={noteHref(note.path)}
      className={cx(
        "group/link inline-flex max-w-full items-center gap-1 rounded-md text-[10px] text-white/40 transition-colors hover:text-white/80",
        className,
      )}
      title={`Abrir ${note.title} en Obsidian`}
    >
      <span className="truncate">{children ?? note.title}</span>
      <ArrowUpRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-hover/link:-translate-y-px group-hover/link:translate-x-px" />
    </Link>
  );
}

export function Empty({ icon, title, hint, className }: { icon?: ReactNode; title: string; hint?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-2 px-4 py-8 text-center", className)}>
      {icon && <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-white/35">{icon}</div>}
      <p className="text-[11px] text-white/50">{title}</p>
      {hint && <p className="max-w-[260px] text-[10px] leading-relaxed text-white/28">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

const formatters = new Map<number, Intl.NumberFormat>();
export function formatNumber(value: number, decimals = 0): string {
  let formatter = formatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, formatter);
  }
  return formatter.format(value);
}

export function compactKg(value: number): string {
  if (value >= 10_000) return `${formatNumber(value / 1000, 1)}k`;
  return formatNumber(Math.round(value));
}

/** Cuenta hacia el nuevo valor cuando cambia; estático con movimiento reducido. */
export function NumberTicker({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const reduce = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduce) {
      from.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => {
        from.current = value;
      },
    });
    return () => {
      from.current = value;
      controls.stop();
    };
  }, [value, reduce]);

  return <span className={className}>{formatNumber(display, decimals)}</span>;
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

export function Sparkline({ points, className, height = 36 }: { points: SeriesPoint[]; className?: string; height?: number }) {
  const gradient = useId();
  const geometry = useMemo(() => {
    if (!points.length) return null;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const first = points[0].key;
    const days = Math.max(1, daysBetween(first, points[points.length - 1].key));
    const coords = points.map((point) => ({
      x: points.length === 1 ? 50 : (daysBetween(first, point.key) / days) * 100,
      y: max === min ? 50 : 88 - ((point.value - min) / span) * 76,
    }));
    const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
    return { coords, line, area: `${line} L${coords[coords.length - 1].x},100 L${coords[0].x},100 Z` };
  }, [points]);

  if (!geometry) return <div className={cx("h-9 w-full rounded-md border border-dashed border-white/[0.06]", className)} style={{ height }} />;
  const end = geometry.coords[geometry.coords.length - 1];

  return (
    <div className={cx("relative w-full", className)} style={{ height }} aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(255,255,255)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="rgb(255,255,255)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geometry.coords.length > 1 && <path d={geometry.area} fill={`url(#${gradient})`} />}
        {geometry.coords.length > 1 && (
          <motion.path
            d={geometry.line}
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        )}
      </svg>
      <span
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-[#0d0d0d]"
        style={{ left: `${end.x}%`, top: `${end.y}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráfica de tendencia con cruz y tooltip
// ---------------------------------------------------------------------------

type Reference = { value: number; label: string };

const PAD = { top: 14, right: 52, bottom: 24, left: 4 } as const;
const NO_REFERENCES: Reference[] = [];

function niceStep(span: number): number {
  const raw = span / 3;
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const normalized = raw / power;
  return (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * power;
}

export function TrendChart({
  points,
  references = NO_REFERENCES,
  height = 180,
  unit,
  decimals = 1,
  label,
  emptyHint,
}: {
  points: SeriesPoint[];
  references?: Reference[];
  height?: number;
  unit: string;
  decimals?: number;
  label: string;
  emptyHint?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pad = PAD;
  const chart = useMemo(() => {
    if (!points.length || width <= 0) return null;
    const values = [...points.map((point) => point.value), ...references.map((reference) => reference.value)];
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 1) {
      min -= 1;
      max += 1;
    }
    const step = niceStep(max - min);
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    const innerWidth = Math.max(10, width - pad.left - pad.right);
    const innerHeight = height - pad.top - pad.bottom;
    const first = points[0].key;
    const days = Math.max(1, daysBetween(first, points[points.length - 1].key));
    const x = (key: string) => (points.length === 1 ? pad.left + innerWidth / 2 : pad.left + (daysBetween(first, key) / days) * innerWidth);
    const y = (value: number) => pad.top + (1 - (value - min) / (max - min)) * innerHeight;
    const coords = points.map((point) => ({ ...point, x: x(point.key), y: y(point.value) }));
    const line = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const ticks: number[] = [];
    for (let value = min; value <= max + step / 2; value += step) ticks.push(Number(value.toFixed(4)));
    return {
      coords,
      line,
      area: coords.length > 1 ? `${line} L${coords[coords.length - 1].x},${pad.top + innerHeight} L${coords[0].x},${pad.top + innerHeight} Z` : "",
      ticks: ticks.map((value) => ({ value, y: y(value) })),
      refs: references.map((reference) => ({ ...reference, y: y(reference.value) })),
      innerWidth,
    };
  }, [points, references, width, height, pad]);

  const gradient = useId();
  const focus = active !== null && chart ? chart.coords[active] : null;

  const onPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!chart) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = event.clientX - rect.left;
    let nearest = 0;
    chart.coords.forEach((point, index) => {
      if (Math.abs(point.x - pointer) < Math.abs(chart.coords[nearest].x - pointer)) nearest = index;
    });
    setActive(nearest);
  };

  const onKey = (event: React.KeyboardEvent) => {
    if (!chart) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setActive((current) => Math.min(chart.coords.length - 1, Math.max(0, (current ?? chart.coords.length - 1) + (current === null ? 0 : delta))));
    }
    if (event.key === "Escape") setActive(null);
  };

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      {!points.length ? (
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/[0.07] text-[10px] text-white/30">{emptyHint ?? "Sin datos todavía"}</div>
      ) : chart ? (
        <>
          <svg
            width={width}
            height={height}
            className="block touch-none outline-none"
            role="img"
            aria-label={`${label}: ${points.map((point) => `${formatShort(point.key)} ${formatNumber(point.value, decimals)} ${unit}`).join(", ")}`}
            tabIndex={0}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(chart.coords.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
          >
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(255,255,255)" stopOpacity="0.1" />
                <stop offset="100%" stopColor="rgb(255,255,255)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {chart.ticks.map((tick) => (
              <g key={tick.value}>
                <line x1={pad.left} x2={pad.left + chart.innerWidth} y1={tick.y} y2={tick.y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                <text x={width - 4} y={tick.y + 3} textAnchor="end" className="fill-white/25 font-mono text-[9px] tabular-nums">
                  {formatNumber(tick.value, tick.value % 1 ? 1 : 0)}
                </text>
              </g>
            ))}
            {chart.refs.map((reference) => (
              <g key={reference.label}>
                <line x1={pad.left} x2={pad.left + chart.innerWidth} y1={reference.y} y2={reference.y} stroke="rgba(255,255,255,0.32)" strokeWidth={1} strokeDasharray="2 4" />
                <text x={pad.left + chart.innerWidth - 2} y={reference.y - 5} textAnchor="end" className="fill-white/45 font-mono text-[9px]">
                  {reference.label}
                </text>
              </g>
            ))}
            {chart.area && <path d={chart.area} fill={`url(#${gradient})`} />}
            {chart.coords.length > 1 && (
              <motion.path
                d={chart.line}
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: EASE }}
              />
            )}
            {chart.coords.map((point, index) => (
              <circle
                key={point.key}
                cx={point.x}
                cy={point.y}
                r={index === chart.coords.length - 1 || chart.coords.length < 12 ? 3.5 : 0}
                fill="rgb(255,255,255)"
                stroke="rgb(13,13,13)"
                strokeWidth={2}
              />
            ))}
            {focus && (
              <g pointerEvents="none">
                <line x1={focus.x} x2={focus.x} y1={pad.top - 6} y2={height - pad.bottom} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
                <circle cx={focus.x} cy={focus.y} r={5} fill="rgb(255,255,255)" stroke="rgb(13,13,13)" strokeWidth={2} />
              </g>
            )}
            <text x={pad.left} y={height - 6} className="fill-white/28 font-mono text-[9px]">{formatShort(points[0].key)}</text>
            {points.length > 1 && (
              <text x={pad.left + chart.innerWidth} y={height - 6} textAnchor="end" className="fill-white/28 font-mono text-[9px]">
                {formatShort(points[points.length - 1].key)}
              </text>
            )}
          </svg>
          {focus && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-black/90 px-3 py-2 shadow-2xl backdrop-blur-xl"
              style={{ left: Math.min(Math.max(focus.x - 60, 0), width - 128), top: Math.max(0, focus.y - 62), width: 128 }}
            >
              <p className="font-mono text-[13px] text-white">
                {formatNumber(focus.value, decimals)} <span className="text-[10px] text-white/45">{unit}</span>
              </p>
              <p className="mt-0.5 text-[10px] text-white/45">{formatShort(focus.key)}</p>
            </motion.div>
          )}
        </>
      ) : null}
    </div>
  );
}

/** Pestañas segmentadas con indicador animado compartido. */
export function Segmented<T extends string>({ value, options, onChange, layoutId }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; layoutId: string }) {
  return (
    <div className="inline-flex items-center rounded-[10px] border border-white/[0.07] bg-white/[0.02] p-0.5" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx("relative h-6 rounded-[8px] px-2.5 text-[10px] transition-colors active:scale-[0.97]", value === option.value ? "text-white" : "text-white/40 hover:text-white/70")}
        >
          {value === option.value && <motion.span layoutId={layoutId} transition={spring} className="absolute inset-0 rounded-[8px] bg-white/[0.08]" />}
          <span className="relative">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Reloj que se actualiza cada `interval` ms. Devuelve 0 antes de montar (evita desajustes de hidratación). */
export function useNow(interval = 1000, enabled = true): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval, enabled]);
  return now;
}

/** true si el foco está en un campo de texto (para no robar teclas al escribir). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Monta overlays en `body` para que ningún ancestro con `backdrop-filter` o `transform` los recorte. */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
