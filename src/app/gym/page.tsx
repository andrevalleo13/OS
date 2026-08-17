"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { MUSCLE_DETAILS } from "@/components/gym/MuscleData";

// Dynamic import avoids SSR issues with Three.js / WebGL
const BodyModel = dynamic(() => import("@/components/gym/BodyModel"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border border-white/10 border-t-[#ff5500] rounded-full animate-spin" />
        <span className="text-[10px] text-gray-600 font-mono tracking-wider">
          Initializing body scan...
        </span>
      </div>
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full h-[calc(100vh-6rem)] flex gap-4 p-2 relative z-10"
    >
      {/* 3D Body Model */}
      <div className="flex-1 bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl overflow-hidden shadow-xl relative min-h-0">
        <BodyModel
          onSelectMuscle={setSelectedMuscle}
          selectedMuscle={selectedMuscle}
          onHoverMuscle={setHoveredMuscle}
        />
      </div>

      {/* Muscle Detail Panel */}
      <div className="w-[260px] shrink-0">
        <AnimatePresence mode="wait">
          {muscleInfo ? (
            <motion.div
              key={activeMuscleId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full bg-[#0a0a0a]/70 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-5 flex flex-col gap-4 overflow-hidden"
            >
              {/* Muscle Name */}
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff5500]" />
                <span className="text-sm font-medium text-white tracking-tight">
                  {muscleInfo.name}
                </span>
              </div>

              <div className="w-full h-[1px] bg-white/5" />

              {/* Last Trained */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">
                  Last Trained
                </span>
                <span className="text-xs text-gray-300">
                  {muscleInfo.lastTrained}
                </span>
              </div>

              {/* Soreness */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">
                    Soreness
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {muscleInfo.soreness}%
                  </span>
                </div>
                <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        muscleInfo.soreness > 60
                          ? "#ff5500"
                          : muscleInfo.soreness > 30
                          ? "#ff8800"
                          : "#666",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${muscleInfo.soreness}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Weekly Volume */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">
                  Weekly Volume
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold text-white font-mono tabular-nums">
                    {muscleInfo.weeklyVolume}
                  </span>
                  <span className="text-[10px] text-gray-500">sets</span>
                </div>
              </div>

              <div className="w-full h-[1px] bg-white/5" />

              {/* Exercises */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">
                  Exercises
                </span>
                {muscleInfo.exercises.map((ex, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-400 flex items-center gap-2"
                  >
                    <div className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />
                    {ex}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full bg-[#0a0a0a]/40 backdrop-blur-xl border border-white/[0.04] rounded-3xl p-5 flex flex-col items-center justify-center gap-3"
            >
              <div className="w-8 h-8 rounded-full border border-white/[0.08] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-700" />
              </div>
              <span className="text-[10px] text-gray-600 font-mono text-center leading-relaxed">
                Hover or select a<br />muscle group
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
