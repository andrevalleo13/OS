"use client";

import { Children, isValidElement, useState, type MouseEvent, type ReactNode } from "react";
import {
  Bug,
  Check,
  ChevronRight,
  CircleCheck,
  CircleQuestionMark,
  ClipboardList,
  Flame,
  Info,
  List,
  Pencil,
  Quote,
  TriangleAlert,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { calloutKind, type CalloutKind } from "@/features/vault/markdown";
import { cn } from "./context";

/**
 * Cada tipo de callout conserva su ícono de Obsidian y se distingue solo con
 * grises: intensidad del fondo, del borde izquierdo y estilo del borde.
 */
const STYLES: Record<CalloutKind, { icon: LucideIcon; box: string; title: string }> = {
  note: { icon: Pencil, box: "border-white/[0.08] border-l-white/40 bg-white/[0.035]", title: "text-white/90" },
  abstract: { icon: ClipboardList, box: "border-white/[0.08] border-l-white/30 bg-white/[0.025]", title: "text-white/85" },
  info: { icon: Info, box: "border-white/[0.09] border-l-white/50 bg-white/[0.045]", title: "text-white/90" },
  todo: { icon: CircleCheck, box: "border-white/[0.08] border-l-white/40 bg-white/[0.02]", title: "text-white/85" },
  tip: { icon: Flame, box: "border-white/[0.12] border-l-white/70 bg-white/[0.06]", title: "text-white" },
  success: { icon: Check, box: "border-white/[0.1] border-l-white/60 bg-white/[0.05]", title: "text-white/95" },
  question: { icon: CircleQuestionMark, box: "border-dashed border-white/[0.12] border-l-white/40 bg-white/[0.025]", title: "text-white/85" },
  warning: { icon: TriangleAlert, box: "border-white/[0.16] border-l-white/80 bg-white/[0.075]", title: "text-white" },
  failure: { icon: X, box: "border-dashed border-white/[0.16] border-l-white/70 bg-white/[0.05]", title: "text-white/95" },
  danger: { icon: Zap, box: "border-white/25 border-l-white bg-white/[0.1]", title: "font-bold text-white" },
  bug: { icon: Bug, box: "border-dotted border-white/[0.18] border-l-white/60 bg-white/[0.04]", title: "text-white/90" },
  example: { icon: List, box: "border-white/[0.06] border-l-white/25 bg-white/[0.015]", title: "text-white/80" },
  quote: { icon: Quote, box: "border-transparent border-l-white/30 bg-transparent", title: "italic text-white/70" },
};

type CalloutProps = {
  type: string;
  fold: string;
  line?: number;
  children?: ReactNode;
};

function hasProp(child: ReactNode, prop: string): boolean {
  return isValidElement(child) && typeof child.props === "object" && child.props !== null && prop in child.props;
}

/** `> [!tipo]± Título`: plegable con `+` (abierto) o `-` (cerrado). */
export function Callout({ type, fold, line, children }: CalloutProps) {
  const kind = calloutKind(type);
  const style = STYLES[kind];
  const foldable = fold === "+" || fold === "-";
  const [open, setOpen] = useState(fold !== "-");
  const items = Children.toArray(children);
  const title = items.find((child) => hasProp(child, "data-callout-title"));
  const body = items.find((child) => hasProp(child, "data-callout-body"));
  const Icon = style.icon;

  const toggle = (event: MouseEvent) => {
    if (!foldable) return;
    if ((event.target as HTMLElement).closest("a, button:not([data-callout-toggle]), input")) return;
    setOpen((value) => !value);
  };

  return (
    <div
      data-callout={kind}
      data-callout-type={type}
      data-line={line}
      className={cn("callout my-4 rounded-md border border-l-2 px-4 py-2.5", style.box)}
    >
      <div
        onClick={toggle}
        className={cn("flex items-start gap-2 text-[0.95em] font-semibold leading-snug", style.title, foldable && "cursor-pointer select-none")}
      >
        <Icon className="mt-[0.2em] size-4 shrink-0 opacity-80" strokeWidth={2} />
        {title}
        {foldable && (
          <button
            type="button"
            data-callout-toggle=""
            aria-expanded={open}
            aria-label={open ? "Plegar" : "Desplegar"}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
            className="ml-auto mt-[0.1em] rounded p-0.5 text-white/40 transition hover:text-white active:scale-90"
          >
            <ChevronRight className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")} />
          </button>
        )}
      </div>
      {open && body}
    </div>
  );
}
