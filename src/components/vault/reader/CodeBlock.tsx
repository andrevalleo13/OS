"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "./context";

/** Bloque de código monoespaciado con botón de copiar. */
export function CodeBlock({ code, lang, line }: { code: string; lang?: string; line?: number }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1_400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="group/code relative my-4" data-line={line}>
      <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-white/[0.035] px-4 py-3 font-mono text-[0.84em] leading-[1.65] text-[#d6d6d6] [scrollbar-width:thin]">
        <code>{code}</code>
      </pre>
      {lang && (
        <span className="pointer-events-none absolute right-9 top-2 font-mono text-[10px] text-white/25 transition-opacity group-hover/code:opacity-0">
          {lang}
        </span>
      )}
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "Copiado" : "Copiar código"}
        title={copied ? "Copiado" : "Copiar"}
        className={cn(
          "absolute right-2 top-2 rounded-md border border-white/[0.08] bg-[#111]/90 p-1 text-white/45 transition hover:text-white active:scale-95",
          copied ? "opacity-100" : "opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100",
        )}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

/** `$$…$$`: sin KaTeX, se muestra como texto monoespaciado centrado. */
export function MathBlock({ code, line }: { code: string; line?: number }) {
  return (
    <div
      data-line={line}
      className="my-4 overflow-x-auto rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-center font-mono text-[0.88em] leading-relaxed text-white/80 [scrollbar-width:thin]"
    >
      <span className="whitespace-pre">{code}</span>
    </div>
  );
}
