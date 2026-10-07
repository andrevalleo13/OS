"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown } from "lucide-react";

/** Qué tan cerca del fondo cuenta todavía como "en el fondo". */
const BOTTOM_THRESHOLD = 56;

type Props = {
  children: ReactNode;
  /** Cambia cuando el contenido crece: número de mensajes, estado, etc. */
  contentKey?: string | number;
  className?: string;
  innerClassName?: string;
};

/**
 * Contenedor de scroll para un hilo. Sigue el fondo solo mientras quien lee
 * ya está ahí: subir a releer es un acto explícito y arrastrarlo de vuelta es
 * la forma más común de arruinar un chat. Si deja de seguir, aparece una
 * píldora para volver.
 */
export function ShadowConversation({ children, contentKey, className = "", innerClassName = "" }: Props) {
  const reduced = useReducedMotion() ?? false;
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const pinnedRef = useRef(true);
  /** Un scroll suave pasa por posiciones "lejos del fondo"; no deben soltar el anclaje. */
  const autoScrollingRef = useRef(false);

  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= BOTTOM_THRESHOLD;
    if (atBottom) autoScrollingRef.current = false;
    else if (autoScrollingRef.current) return;
    setPinned(atBottom);
  }, []);

  const releaseAutoScroll = useCallback(() => {
    autoScrollingRef.current = false;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    autoScrollingRef.current = behavior === "smooth";
    if (typeof viewport.scrollTo === "function") viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    else viewport.scrollTop = viewport.scrollHeight;
    setPinned(true);
  }, []);

  // En el mismo frame en que crece el contenido, para no mostrar el salto.
  useLayoutEffect(() => {
    if (pinned) scrollToBottom(reduced ? "auto" : "smooth");
  }, [contentKey, pinned, reduced, scrollToBottom]);

  // El contenido también crece sin que cambie la clave: widgets, imágenes, revelados.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (pinnedRef.current) viewport.scrollTop = viewport.scrollHeight;
      else measure();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className={`relative h-full min-h-0 w-full ${className}`}>
      <div ref={viewportRef} onScroll={measure} onWheel={releaseAutoScroll} onTouchStart={releaseAutoScroll} className="h-full overflow-y-auto overscroll-contain">
        <div ref={contentRef} className={innerClassName}>{children}</div>
      </div>
      <AnimatePresence initial={false}>
        {!pinned ? (
          <motion.button
            type="button"
            onClick={() => scrollToBottom(reduced ? "auto" : "smooth")}
            initial={reduced ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.25 }}
            className="absolute inset-x-0 bottom-4 z-20 mx-auto flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-[#0a0a0a]/90 py-1.5 pl-2.5 pr-3 text-[10px] text-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-3xl transition-colors hover:text-white"
            aria-label="Ir al último mensaje"
          >
            <ArrowDown className="h-3 w-3" />
            Ir a lo último
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
