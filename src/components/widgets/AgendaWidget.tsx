"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, GraduationCap, Briefcase } from "lucide-react";
import { useState } from "react";
import { WidgetCard, useWidget } from "@/components/ui/widget";

export default function AgendaWidget({ itemVariants }: any) {
  const [tasks, setTasks] = useState([
    { id: 1, type: "class", title: "Arquitectura de Software", time: "11:00 AM", done: true, desc: "Presentación del proyecto final" },
    { id: 2, type: "work", title: "Review PRs for Client App", time: "2:00 PM", done: false, desc: "Revisar PR #45 y #46" },
    { id: 3, type: "class", title: "Inteligencia Artificial", time: "4:00 PM", done: false, desc: "Laboratorio de redes neuronales" },
    { id: 4, type: "work", title: "Send Weekly Report", time: "6:00 PM", done: false, desc: "Enviar a management" },
  ]);

  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "agenda";
  const isShrunk = activeWidgetId !== null && activeWidgetId !== "agenda";

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const progress = (tasks.filter(t => t.done).length / tasks.length) * 100;
  const nextTask = tasks.find(t => !t.done);

  return (
    <WidgetCard 
      id="agenda"
      defaultClassName="col-span-1 md:col-span-2 flex flex-col justify-between min-h-[420px]"
      expandedClassName="col-span-1 md:col-span-4 flex flex-col justify-between min-h-[400px]"
      shrunkClassName="col-span-1 md:col-span-2 flex flex-col justify-between min-h-[140px]"
    >
      <motion.div layout className="z-10 flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
           <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">
             {isExpanded ? "Detailed Agenda" : "Today's Agenda"}
           </span>
        </div>
        <motion.div layout className="text-xs font-mono text-[#ededed]">{Math.round(progress)}%</motion.div>
      </motion.div>

      <motion.div layout className={`z-10 w-full bg-white/[0.05] h-[2px] rounded-full overflow-hidden relative ${isShrunk ? "mb-4" : "mb-6"}`}>
        <motion.div 
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full absolute left-0 top-0 bg-[#ededed] rounded-full" 
        />
      </motion.div>

      <AnimatePresence mode="popLayout">
        {isShrunk ? (
          <motion.div 
            key="shrunk"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-2 flex-1 justify-center items-center text-center pb-4"
          >
            <div className="text-[10px] font-mono text-[#666] uppercase tracking-widest">Next Up</div>
            {nextTask ? (
              <>
                <div className="text-[13px] font-medium text-[#ededed] leading-tight line-clamp-2">{nextTask.title}</div>
                <div className="text-[10px] font-mono text-[#666]">{nextTask.time}</div>
              </>
            ) : (
              <div className="text-[13px] font-medium text-[#888]">All done!</div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="normal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="z-10 flex flex-col gap-2 flex-1 overflow-y-auto pr-2 scrollbar-none"
          >
            {tasks.map((task, i) => (
              <motion.div 
                layout
                key={task.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTask(task.id);
                }}
                className={`flex flex-col py-3 px-4 rounded-xl cursor-pointer transition-all border ${
                  task.done 
                    ? "bg-transparent border-transparent opacity-40" 
                    : "bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-4 w-full">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-colors shrink-0 ${
                    task.done ? "bg-[#ededed] border-[#ededed]" : "border-[#444] bg-transparent"
                  }`}>
                    {task.done && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={`text-[13px] font-medium tracking-tight truncate ${task.done ? "text-[#888] line-through" : "text-[#ededed]"}`}>
                      {task.title}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {task.type === "class" ? (
                        <GraduationCap className="w-3 h-3 shrink-0 text-[#666]" />
                      ) : (
                        <Briefcase className="w-3 h-3 shrink-0 text-[#666]" />
                      )}
                      <span className="text-[10px] font-mono text-[#666]">{task.time}</span>
                    </div>
                  </div>
                </div>
                
                <AnimatePresence>
                  {isExpanded && !task.done && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pl-8 mt-2 text-xs text-[#666]"
                    >
                      {task.desc}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </WidgetCard>
  );
}
