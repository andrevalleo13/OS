"use client";

import { motion } from "framer-motion";
import { useWidget } from "./WidgetContext";
import { ReactNode } from "react";

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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      layout
      onClick={handleClick}
      initial={{ opacity: 0, y: 15 }}
      animate={{ 
        opacity: isAnotherExpanded ? 0.3 : 1, 
        y: 0 
      }}
      whileHover={isAnotherExpanded ? {} : { y: -2 }}
      transition={{ 
        layout: { type: "spring", bounce: 0.1, duration: 0.5 },
        opacity: { duration: 0.4 }
      }}
      className={`
        bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-6 cursor-pointer relative overflow-hidden group 
        ${isAnotherExpanded ? "" : "hover:border-white/[0.15]"}
        ${gridClasses}
      `}
    >
      {/* Vercel-style subtle top highlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Expose expanded state to children using a render prop or just let children use `useWidget()` */}
      {children}
    </motion.div>
  );
}
