"use client";

import { motion } from "framer-motion";
import { useWidget } from "./WidgetContext";
import { ReactNode, useEffect, useRef } from "react";

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
  const { activeWidgetId, setActiveWidgetId } = useWidget();
  
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ 
        opacity: isAnotherExpanded ? 0.52 : 1,
        y: 0 
      }}
      whileHover={isAnotherExpanded ? {} : { y: -2 }}
      whileTap={isAnotherExpanded ? {} : { scale: 0.997 }}
      transition={{ 
        layout: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.22 },
        transform: { duration: 0.18 },
      }}
      className={`
        os-widget os-surface relative scroll-mt-24 overflow-hidden rounded-[22px] bg-[#0d0d0d]/92 p-5 sm:p-6 group
        ${isExpanded ? "z-20" : "z-10"}
        ${isAnotherExpanded ? "cursor-default" : "cursor-pointer hover:border-white/[0.14]"}
        ${gridClasses}
      `}
    >
      {/* Vercel-style subtle top highlight */}
      <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--accent)]/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      
      {/* Expose expanded state to children using a render prop or just let children use `useWidget()` */}
      {children}
    </motion.div>
  );
}
