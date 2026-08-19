"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, BrainCircuit } from "lucide-react";
import { useState, useEffect } from "react";
import { WidgetCard, useWidget } from "@/components/ui/widget";

import { getNotes, addNote } from "@/actions/notes";

export default function QuickNotesWidget({ itemVariants }: any) {
  const [note, setNote] = useState("");
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "notes";
  const isShrunk = activeWidgetId !== null && activeWidgetId !== "notes";

  useEffect(() => {
    async function loadNotes() {
      const data = await getNotes();
      setRecentNotes(data);
      setIsLoading(false);
    }
    loadNotes();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    
    // Optimistic UI update
    const optimisticNote = { id: 'temp', title: note, time: "Just now", content: "" };
    setRecentNotes(prev => [optimisticNote, ...prev]);
    setNote("");
    
    // Save to DB
    const newNote = await addNote(optimisticNote.title);
    
    // Update with real DB note
    setRecentNotes(prev => [newNote, ...prev.filter(n => n.id !== 'temp')]);
  };

  const displayNotes = isExpanded ? recentNotes : recentNotes.slice(0, 2);

  return (
    <WidgetCard 
      id="notes"
      defaultClassName="col-span-1 flex flex-col min-h-[200px] h-full"
      expandedClassName="col-span-1 lg:col-span-3 row-span-2 flex flex-col min-h-[400px] h-full"
      shrunkClassName="col-span-1 flex flex-col min-h-[140px] h-full"
    >
      <motion.div layout className="z-10 flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
           <BrainCircuit className="w-3.5 h-3.5 text-[#ededed]" />
           <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">
             Second Brain
           </span>
        </div>
      </motion.div>

      <motion.form layout onSubmit={handleSave} className="z-10 relative mb-2">
        <input 
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quick capture..."
          className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl pl-3 pr-10 py-2.5 text-[13px] text-[#ededed] placeholder-[#666] focus:outline-none focus:border-white/[0.2] focus:bg-white/[0.04] transition-all"
        />
        <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center bg-transparent hover:bg-white/[0.1] text-[#888] hover:text-[#ededed] rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </motion.form>

      <AnimatePresence>
        {!isShrunk && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`z-10 flex flex-col gap-3 mt-4 flex-1 ${isExpanded ? 'overflow-y-auto pr-2 scrollbar-none' : ''}`}
          >
            {displayNotes.map((n) => (
              <motion.div layout key={n.id} className="flex flex-col group/note cursor-default p-3 -mx-3 rounded-lg hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/[0.05]">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-medium text-[#ededed] truncate max-w-[70%]">{n.title}</span>
                  <span className="text-[10px] font-mono text-[#555]">{n.time || "Just now"}</span>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: "auto" }} 
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[12px] text-[#888] mt-2 leading-relaxed"
                    >
                      {n.content || "No additional content."}
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
