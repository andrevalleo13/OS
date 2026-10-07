"use client";

import { motion } from "framer-motion";
import { useWidget } from "./WidgetContext";
import { ReactNode, useEffect, useRef, useState } from "react";

/** Separación entre tarjetas en la cascada de entrada. */
const INTRO_STAGGER = 0.055;

interface WidgetCardProps {
  id: string;
  children: ReactNode;
  defaultClassName?: string;
  expandedClassName?: string;
  shrunkClassName?: string;
  onClick?: () => void;
}

export function WidgetCard({ 
  id, 
  children, 
  defaultClassName = "", 
  expandedClassName = "", 
  shrunkClassName = "",
  onClick 
}: WidgetCardProps) {
  const { activeWidgetId, setActiveWidgetId, introOrder } = useWidget();
  const [entered, setEntered] = useState(false);
  const introDelay = entered ? 0 : Math.max(0, introOrder.indexOf(id)) * INTRO_STAGGER;
  
  const isExpanded = activeWidgetId === id;
  const isAnotherExpanded = activeWidgetId !== null && activeWidgetId !== id;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) return;
    const timeout = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [isExpanded]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, form, [data-no-expand]")) return;
    // Only toggle if they click the card itself or if they passed a specific onClick we want to compose
    if (onClick) onClick();
    setActiveWidgetId(isExpanded ? null : id);
  };

  // El brillo sigue al puntero escribiendo variables CSS: sin renders por movimiento.
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card || event.pointerType !== "mouse") return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  // Determine which grid classes to apply based on the global state
  const gridClasses = isExpanded 
    ? expandedClassName 
    : (isAnotherExpanded && shrunkClassName ? shrunkClassName : defaultClassName);

  return (
    <motion.div
      ref={cardRef}
      layout
      data-widget={id}
      data-expanded={isExpanded}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
      animate={{ 
        opacity: isAnotherExpanded ? 0.52 : 1,
        y: 0,
        filter: "blur(0px)",
        // Un filter distinto de none crea un bloque contenedor para hijos fixed.
        transitionEnd: { filter: "none" },
      }}
      onAnimationComplete={() => setEntered(true)}
      whileHover={isAnotherExpanded ? {} : { y: -2 }}
      whileTap={isAnotherExpanded ? {} : { scale: 0.997 }}
      transition={{ 
        layout: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: entered ? 0.22 : 0.45, delay: introDelay, ease: "easeOut" },
        filter: { duration: 0.45, delay: introDelay, ease: "easeOut" },
        y: entered ? { type: "spring", stiffness: 420, damping: 30 } : { type: "spring", stiffness: 180, damping: 22, delay: introDelay },
      }}
      className={`
        os-widget os-surface relative scroll-mt-24 overflow-hidden rounded-[22px] bg-[#0d0d0d]/92 p-5 sm:p-6 group
        ${isExpanded ? "z-20" : "z-10"}
        ${isAnotherExpanded ? "cursor-default" : "cursor-pointer hover:border-white/[0.14]"}
        ${gridClasses}
      `}
    >
      {/* Brillo que sigue al puntero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(520px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(255,255,255,0.045), transparent 42%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          padding: 1,
          background: "radial-gradient(260px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(255,255,255,0.22), transparent 60%)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      {/* Vercel-style subtle top highlight */}
      <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--accent)]/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      
      {/* Expose expanded state to children using a render prop or just let children use `useWidget()` */}
      {children}
    </motion.div>
  );
}
