"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { ChevronRight, Dumbbell, History, Trophy, Activity, Target } from "lucide-react";
import { 
  MUSCLE_DETAILS, 
  MOCK_CURRENT_ROUTINE, 
  MOCK_SESSION_HISTORY, 
  MOCK_PRS 
} from "@/components/gym/MuscleData";

const BodyModel = dynamic(() => import("@/components/gym/BodyModel"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]/40">
      <div className="w-6 h-6 border border-white/10 border-t-[#ff5500] rounded-full animate-spin" />
      <span className="text-[10px] text-gray-500 font-mono tracking-wider">Awaiting high-res .glb asset...</span>
    </div>
  ),
});

export default function GymPage() {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);

  const activeMuscleId = selectedMuscle || hoveredMuscle;
  const muscleInfo = activeMuscleId ? MUSCLE_DETAILS[activeMuscleId] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full h-[calc(100vh-6rem)] grid grid-cols-12 grid-rows-2 gap-4 p-2 relative z-10 overflow-hidden"
    >
      {/* ────────────────────────────────────────────── */}
      {/* SECTION 1: 3D Body Model (Col 1-5, Row 1-2)    */}
      {/* ────────────────────────────────────────────── */}
      <div className="col-span-12 lg:col-span-5 row-span-2 flex flex-col gap-4">
        {/* The 3D Canvas */}
        <div className="flex-1 bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl overflow-hidden shadow-xl relative min-h-[400px]">
          <BodyModel
            onSelectMuscle={setSelectedMuscle}
            selectedMuscle={selectedMuscle}
            onHoverMuscle={setHoveredMuscle}
          />
        </div>

        {/* Dynamic Muscle Detail Panel (Slides up when a muscle is active) */}
        <AnimatePresence mode="popLayout">
          {muscleInfo && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              className="bg-[#0a0a0a]/70 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-5 shrink-0"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Activity size={14} className="text-[#ff5500]" />
                  <span className="text-sm font-medium text-white">{muscleInfo.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                  <span>Soreness: {muscleInfo.soreness}%</span>
                  <div className="w-16 h-[2px] bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[#ff5500]"
                      initial={{ width: 0 }}
                      animate={{ width: `${muscleInfo.soreness}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-gray-500 uppercase font-mono">Weekly Volume</span>
                  <span className="text-sm text-gray-200">{muscleInfo.weeklyVolume} sets</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-gray-500 uppercase font-mono">Last Trained</span>
                  <span className="text-sm text-gray-200">{muscleInfo.lastTrained}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ────────────────────────────────────────────── */}
      {/* SECTION 2: Current Routine (Col 6-12, Row 1)   */}
      {/* ────────────────────────────────────────────── */}
      <div className="col-span-12 lg:col-span-7 row-span-1 bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#111] border border-white/10 flex items-center justify-center">
              <Dumbbell size={14} className="text-gray-400" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">{MOCK_CURRENT_ROUTINE.name}</h2>
              <span className="text-[10px] text-gray-500 font-mono">{MOCK_CURRENT_ROUTINE.day}</span>
            </div>
          </div>
          <button className="px-4 py-1.5 bg-[#ff5500] hover:bg-[#ff6600] text-white text-[10px] font-bold tracking-wider uppercase rounded-full transition-colors">
            Start Session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex flex-col gap-2">
            {MOCK_CURRENT_ROUTINE.exercises.map((ex, i) => (
              <div key={ex.id} className="group flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.02] border border-transparent hover:border-white/[0.04] transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600 font-mono w-4">{i + 1}.</span>
                  <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{ex.name}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono">
                  <span className="text-gray-500">{ex.sets} × {ex.reps}</span>
                  <div className="w-px h-3 bg-white/10" />
                  <span className="text-[#ff5500]/80">RPE {ex.targetRpe}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────── */}
      {/* SECTION 3: Session History (Col 6-9, Row 2)    */}
      {/* ────────────────────────────────────────────── */}
      <div className="col-span-12 lg:col-span-4 row-span-1 bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <History size={14} className="text-gray-400" />
          <h2 className="text-xs font-medium text-gray-200">Session Log</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex flex-col gap-4">
            {MOCK_SESSION_HISTORY.map((session) => (
              <div key={session.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">{session.routineName}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{session.date}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
                  <span>{session.duration}</span>
                  <div className="w-1 h-1 rounded-full bg-white/10" />
                  <span>{(session.totalVolume / 1000).toFixed(1)}k kg moved</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────── */}
      {/* SECTION 4: Personal Records (Col 10-12, Row 2) */}
      {/* ────────────────────────────────────────────── */}
      <div className="col-span-12 lg:col-span-3 row-span-1 bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <Trophy size={14} className="text-[#ffb700]" />
          <h2 className="text-xs font-medium text-gray-200">Personal Records</h2>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex flex-col gap-3">
            {MOCK_PRS.map((pr) => (
              <div key={pr.id} className="flex flex-col p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-gray-500 font-mono mb-1">{pr.lift}</span>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-semibold text-white">{pr.weight}</span>
                    <span className="text-[9px] text-gray-500">kg</span>
                  </div>
                  <span className="text-[9px] text-[#ff5500]/70 font-mono">{pr.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </motion.div>
  );
}
