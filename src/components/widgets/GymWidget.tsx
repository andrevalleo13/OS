"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Play, Activity } from "lucide-react";
import { useState } from "react";
import { WidgetCard, useWidget } from "@/components/ui/widget";

export default function GymWidget({ itemVariants }: any) {
  const [isActive, setIsActive] = useState(false);
  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "gym";
  const isShrunk = activeWidgetId !== null && activeWidgetId !== "gym";

  return (
    <WidgetCard 
      id="gym"
      onClick={() => setIsActive(!isActive)}
      defaultClassName="col-span-1 md:col-span-2 flex flex-col justify-between min-h-[420px]"
      expandedClassName="col-span-1 md:col-span-4 flex flex-col justify-between min-h-[400px]"
      shrunkClassName="col-span-1 md:col-span-2 flex flex-col justify-between min-h-[140px]"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div 
        className="absolute inset-0 pointer-events-none transition-colors duration-1000"
        style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.02)' : 'transparent' }} 
      />

      <motion.div layout className="z-10 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
           <Activity className={`w-3.5 h-3.5 ${isActive ? "text-[#ededed]" : "text-[#666]"}`} />
           <span className="font-mono text-[10px] uppercase tracking-widest text-[#888] truncate">
             {isActive ? "Session Active" : "Scheduled Today"}
           </span>
        </div>
        {isActive && (
           <div className="flex gap-[3px] items-center h-3 overflow-hidden opacity-80 shrink-0">
             <motion.div animate={{ height: [4, 10, 4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-[2px] rounded-full bg-[#ededed]" />
             <motion.div animate={{ height: [6, 12, 6] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.1 }} className="w-[2px] rounded-full bg-[#ededed]" />
             <motion.div animate={{ height: [4, 8, 4] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-[2px] rounded-full bg-[#ededed]" />
           </div>
        )}
      </motion.div>

      <AnimatePresence mode="popLayout">
        {!isShrunk && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            layout 
            className="z-10 mt-auto"
          >
            {isActive ? (
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <motion.h3 layout className="text-xl font-medium tracking-tight text-[#ededed] truncate">Push Day</motion.h3>
                  <motion.p layout className="text-[13px] text-[#888] truncate">Incline Dumbbell Press (Set 3/4)</motion.p>
                </div>
                <motion.div layout className="text-3xl font-mono tracking-tighter text-[#ededed] shrink-0">
                  45<span className="text-sm text-[#666] ml-0.5">m</span>
                </motion.div>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5 min-w-0">
                   <motion.h3 layout className="text-xl font-medium tracking-tight text-[#ededed] truncate">Push Day</motion.h3>
                   <motion.p layout className="text-[13px] text-[#888] truncate">Hypertrophy Block • 6 Exercises</motion.p>
                </div>
                <button className="shrink-0 w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center group-hover:bg-white/[0.1] active:scale-95 transition-all">
                   <Play className="w-4 h-4 fill-[#ededed] text-[#ededed] ml-0.5" />
                </button>
              </div>
            )}
          </motion.div>
        )}
        
        {isShrunk && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-center items-center pb-4"
          >
            <div className="text-[13px] font-medium text-[#ededed]">Push Day</div>
            <div className="text-[10px] font-mono text-[#666] mt-1">{isActive ? "In progress" : "6 Exercises"}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Content View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-8 flex flex-col gap-4 overflow-hidden"
          >
            <div className="w-full h-[1px] bg-white/[0.05]" />
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-mono text-[#888] uppercase tracking-widest">Exercise List</h4>
              {isActive && <div className="text-[10px] font-mono text-[#ededed] bg-white/[0.1] px-2 py-0.5 rounded-full">REST: 01:30</div>}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {['Incline DB Press', 'Pec Deck', 'Lateral Raises', 'Tricep Pushdown', 'Overhead Press', 'Cable Crossovers'].map((ex, i) => (
                <div key={ex} className={`p-3 rounded-xl border text-sm transition-colors ${
                  isActive && i === 0 
                    ? "bg-white/[0.05] border-white/[0.2] text-[#ededed]" 
                    : "bg-white/[0.02] border-white/[0.05] text-[#888]"
                }`}>
                  {ex}
                  {isActive && i === 0 && <div className="text-[10px] font-mono text-green-400 mt-1">IN PROGRESS</div>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isActive && !isShrunk && (
        <motion.div layout className="z-10 mt-6 w-full bg-white/[0.05] h-[2px] rounded-full overflow-hidden relative">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "65%" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full absolute left-0 top-0 bg-[#ededed] rounded-full" 
          />
        </motion.div>
      )}
    </WidgetCard>
  );
}
