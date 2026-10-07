"use client";

import { memo, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Solo se revelan las respuestas recién llegadas, nunca el historial. */
const FRESH_MS = 10_000;

type Props = {
  text: string;
  createdAt?: string;
  /** Desactiva el revelado (p. ej. con animaciones en pausa). */
  reveal?: boolean;
  /** El texto sigue llegando: muestra el cursor y omite el revelado. */
  streaming?: boolean;
  className?: string;
};

const PROSE =
  "prose prose-invert max-w-none text-[13px] font-light leading-relaxed text-white/72 prose-headings:font-medium prose-headings:text-white/85 prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-strong:text-white/85 prose-code:text-white/65 prose-pre:border prose-pre:border-white/[0.065] prose-pre:bg-white/[0.025] prose-a:text-white/80";

function motionAllowed() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && document.documentElement.dataset.reducedMotion !== "true";
}

/**
 * Respuesta de Shadow. Al llegar, cada bloque emerge del desenfoque en
 * cascada: una línea de tiempo GSAP coordinada sobre los párrafos y elementos
 * de lista, que se limpia sola al terminar para no dejar estilos colgados.
 */
export const ShadowResponse = memo(function ShadowResponse({ text, createdAt, reveal = true, streaming = false, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    // Una respuesta que llegó en vivo ya se "reveló" mientras se escribía.
    if (!node || !reveal || !createdAt || streaming) return;
    if (Date.now() - new Date(createdAt).getTime() > FRESH_MS || !motionAllowed()) return;
    const targets = Array.from(node.children).flatMap((block) =>
      block.matches("ul, ol") ? Array.from(block.children) : [block],
    );
    if (targets.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 6, filter: "blur(6px)" },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.55,
          ease: "power3.out",
          stagger: Math.min(0.09, 0.7 / targets.length),
          clearProps: "opacity,visibility,transform,filter",
        },
      );
    }, node);
    return () => ctx.revert();
    // Solo al montar: el revelado no debe repetirse cuando termina el streaming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdAt, reveal]);

  return (
    <div ref={ref} className={`${PROSE} ${streaming ? "shadow-streaming" : ""} ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
});
