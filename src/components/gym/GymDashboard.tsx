"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { History, Trophy, Activity, Target, Flame } from "lucide-react";
import { MUSCLE_DETAILS, WEEKLY_ROUTINES, SessionHistory, PersonalRecord, DayRoutine } from "@/components/gym/MuscleData";
import { logSteps, logWeight } from "@/app/actions/gym";
import { containerVariants, itemVariants } from "@/lib/animations";
import ActiveSession from "@/components/gym/ActiveSession";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';
import { X } from "lucide-react";

const BodyModel = dynamic(() => import("@/components/gym/BodyModel"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]/40">
      <div className="w-6 h-6 border border-white/10 border-t-white rounded-full animate-spin" />
      <span className="text-[10px] text-gray-500 font-mono tracking-wider">INITIALIZING SCANS...</span>
    </div>
  ),
});

interface GymDashboardProps {
  sessionHistory: SessionHistory[];
  personalRecords: PersonalRecord[];
  muscleStats: Record<string, { soreness: number, weeklyVolume: number, lastTrained: string, exercises: string[] }>;
  liftHistory: Record<string, { date: string, weight: number }[]>;
  lifetimeVolume: number;
  totalWorkouts: number;
  heatmap: Record<string, number>;
  currentWeight: number;
}

export default function GymDashboard({ sessionHistory, personalRecords, muscleStats, liftHistory, lifetimeVolume, totalWorkouts, heatmap, currentWeight }: GymDashboardProps) {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);
  const [currentRoutine, setCurrentRoutine] = useState<DayRoutine | null>(null);
  const [loggingSteps, setLoggingSteps] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [selectedPrGraph, setSelectedPrGraph] = useState<string | null>(null);
  
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [weightInput, setWeightInput] = useState(currentWeight.toString());
  const [isSavingWeight, setIsSavingWeight] = useState(false);

  useEffect(() => {
    const today = new Date().getDay();
    setCurrentRoutine(WEEKLY_ROUTINES[today]);
  }, []);

  const handleLogSteps = async () => {
    setLoggingSteps(true);
    await logSteps(10000);
    setTimeout(() => setLoggingSteps(false), 2000);
  };

  const handleWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newWeight = parseFloat(weightInput);
    if (!isNaN(newWeight)) {
      setIsSavingWeight(true);
      await logWeight(newWeight);
      setIsSavingWeight(false);
      setIsEditingWeight(false);
    }
  };

  const activeMuscleId = selectedMuscle || hoveredMuscle;
  const muscleInfo = activeMuscleId ? { 
    name: MUSCLE_DETAILS[activeMuscleId]?.name || activeMuscleId,
    soreness: muscleStats[activeMuscleId]?.soreness || 0,
    weeklyVolume: muscleStats[activeMuscleId]?.weeklyVolume || 0,
    lastTrained: muscleStats[activeMuscleId]?.lastTrained || 'Nunca',
    exercises: muscleStats[activeMuscleId]?.exercises || []
  } : null;

  const muscleSorenessMap: Record<string, number> = {};
  for (const [id, stats] of Object.entries(muscleStats)) {
    muscleSorenessMap[id] = stats.soreness;
  }

  // Bulking Journey Logic
  const GOAL_WEIGHT = 70.0;
  const START_WEIGHT = 62.0;
  
  // Calculate progress, ensuring it stays between 0% and 100%
  let bulkProgress = ((currentWeight - START_WEIGHT) / (GOAL_WEIGHT - START_WEIGHT)) * 100;
  if (bulkProgress < 0) bulkProgress = 0;
  if (bulkProgress > 100) bulkProgress = 100;

  // Radar Data
  const radarData = Object.keys(muscleStats).filter(id => muscleStats[id].weeklyVolume > 0).map(id => ({
    muscle: MUSCLE_DETAILS[id]?.name || id,
    volume: muscleStats[id].weeklyVolume
  }));

  // Heatmap Data (Last 90 days)
  const heatmapDays = Array.from({ length: 90 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (89 - i));
    const dateStr = d.toISOString().split('T')[0];
    return { dateStr, count: heatmap[dateStr] || 0 };
  });

  return (
    <div className="relative w-full min-h-[calc(100vh-6rem)] pb-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
      <AnimatePresence>
        {isTraining && currentRoutine && (
          <ActiveSession 
            key="active-session"
            routine={currentRoutine} 
            liftHistory={liftHistory}
            onFinish={() => setIsTraining(false)} 
          />
        )}
        {selectedPrGraph && liftHistory[selectedPrGraph] && (
          <motion.div
            key="pr-modal"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-0 bg-[#0a0a0a]/95 backdrop-blur-3xl z-40 rounded-3xl border border-white/10 flex flex-col p-6 m-4"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-medium text-white">{selectedPrGraph}</h2>
                <span className="text-xs text-gray-500 font-mono tracking-wider uppercase">Progression Trend</span>
              </div>
              <button 
                onClick={() => setSelectedPrGraph(null)}
                className="w-8 h-8 flex items-center justify-center bg-transparent hover:bg-white/5 border border-transparent hover:border-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liftHistory[selectedPrGraph]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="date" stroke="#666" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#666" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} width={30} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#222', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line 
                    type="stepAfter" 
                    dataKey="weight" 
                    stroke="#fff" 
                    strokeWidth={1.5}
                    dot={{ fill: '#0a0a0a', stroke: '#fff', strokeWidth: 1.5, r: 3 }}
                    activeDot={{ r: 4, fill: '#fff', stroke: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="w-full flex flex-col gap-4 p-4 relative z-10"
      >
        {/* BULKING JOURNEY BAR */}
        <motion.div variants={itemVariants} className="w-full flex flex-col gap-2">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white tracking-widest uppercase">Bulking Journey</span>
                <span className="text-[10px] text-gray-500 font-mono tracking-wider">Target: {GOAL_WEIGHT} kg</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end">
              {isEditingWeight ? (
                <form onSubmit={handleWeightSubmit} className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-16 bg-transparent border-b border-white text-white text-right text-sm font-mono focus:outline-none"
                    autoFocus
                    onBlur={() => setIsEditingWeight(false)}
                    disabled={isSavingWeight}
                  />
                  <span className="text-[10px] text-gray-500 font-mono">kg</span>
                </form>
              ) : (
                <div 
                  className="group flex items-baseline gap-1 cursor-pointer"
                  onClick={() => {
                    setWeightInput(currentWeight.toString());
                    setIsEditingWeight(true);
                  }}
                >
                  <span className="text-sm text-white font-mono group-hover:underline decoration-white/30 underline-offset-4 cursor-text transition-all">{currentWeight.toFixed(1)}</span>
                  <span className="text-[10px] text-gray-500 font-mono tracking-wider">/ {GOAL_WEIGHT.toFixed(1)} kg</span>
                </div>
              )}
              <span className="text-[10px] text-gray-600 font-mono tracking-wider">{totalWorkouts} Workouts logged</span>
            </div>
          </div>
          <div className="w-full h-px bg-white/10 overflow-hidden mt-1">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${bulkProgress}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full bg-white"
            />
          </div>
        </motion.div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-12 grid-rows-2 gap-4 h-[600px]">
          {/* SECTION 1: 3D Body Model */}
          <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4 row-span-2 flex flex-col gap-4">
            <div className="flex-1 bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl overflow-hidden shadow-xl relative min-h-[400px]">
              <BodyModel
                onSelectMuscle={setSelectedMuscle}
                selectedMuscle={selectedMuscle}
                onHoverMuscle={setHoveredMuscle}
                muscleSoreness={muscleSorenessMap}
              />
            </div>

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
                      <Activity size={14} className="text-gray-400" />
                      <span className="text-sm font-medium text-white">{muscleInfo.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                      <span>Soreness: {muscleInfo.soreness}%</span>
                      <div className="w-16 h-[2px] bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-[#ff0033]"
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
          </motion.div>

          {/* SECTION 2: Current Routine */}
          <motion.div 
            variants={itemVariants}
            className="col-span-12 lg:col-span-8 row-span-1 bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-medium text-white">{currentRoutine?.name || "Cargando..."}</h2>
                <span className="text-[10px] text-gray-500 font-mono">{currentRoutine?.day || ""}</span>
              </div>
              <button 
                onClick={currentRoutine?.isRest ? handleLogSteps : () => setIsTraining(true)}
                disabled={loggingSteps}
                className="px-4 py-1.5 bg-white hover:bg-gray-200 disabled:opacity-50 text-black text-[10px] font-bold tracking-wider uppercase rounded-full transition-colors"
              >
                {loggingSteps ? "Registrado ✓" : currentRoutine?.isRest ? "Registrar 10k Pasos" : "Start Session"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex flex-col gap-2">
                {currentRoutine?.exercises.map((ex, i) => (
                  <div key={ex.id} className="group flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.02] border border-transparent hover:border-white/[0.04] transition-all">
                    <div className="flex items-center gap-3">
                      {!currentRoutine?.isRest && <span className="text-[10px] text-gray-600 font-mono w-4">{i + 1}.</span>}
                      <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{ex.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-mono">
                      <span className="text-gray-500">{ex.sets > 0 ? `${ex.sets} × ${ex.reps}` : ex.reps}</span>
                      {!currentRoutine?.isRest && ex.targetRpe && (
                        <>
                          <div className="w-px h-3 bg-white/10" />
                          <span className="text-gray-400">RPE {ex.targetRpe}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* SECTION 3: Radar Chart & PRs */}
          <motion.div 
            variants={itemVariants}
            className="col-span-12 lg:col-span-8 row-span-1 grid grid-cols-2 gap-4"
          >
            {/* Radar Imbalance Chart */}
            <div className="bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl flex flex-col overflow-hidden relative">
              <div className="flex items-center gap-3 mb-2">
                <Target size={14} className="text-gray-400" />
                <h2 className="text-xs font-medium text-white">Structural Balance</h2>
              </div>
              <div className="absolute inset-0 pt-10">
                {radarData.length > 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#222" />
                      <PolarAngleAxis dataKey="muscle" tick={{ fill: '#666', fontSize: 9, fontFamily: 'monospace' }} />
                      <Radar name="Volume" dataKey="volume" stroke="#fff" strokeWidth={1} fill="#ffffff" fillOpacity={0.03} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600 font-mono">
                    Insufficient data for radar
                  </div>
                )}
              </div>
            </div>

            {/* Personal Records */}
            <div className="bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <Trophy size={14} className="text-gray-400" />
                <h2 className="text-xs font-medium text-white">Personal Records</h2>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex flex-col gap-3">
                  {personalRecords.length === 0 ? (
                    <span className="text-xs text-gray-500 italic">No hay récords registrados aún.</span>
                  ) : (
                    personalRecords.slice(0, 5).map((pr) => (
                      <div 
                        key={pr.id} 
                        onClick={() => setSelectedPrGraph(pr.lift)}
                        className="flex flex-col p-3 rounded-2xl bg-white/[0.01] border border-white/[0.04] hover:border-white/20 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      >
                        <span className="text-[10px] text-gray-500 font-mono mb-1 group-hover:text-white transition-colors">{pr.lift}</span>
                        <div className="flex items-baseline justify-between">
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-semibold text-white">{pr.weight}</span>
                            <span className="text-[9px] text-gray-500">kg</span>
                          </div>
                          <span className="text-[9px] text-gray-500 font-mono">{pr.date}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* SECTION 4: GitHub Heatmap */}
        <motion.div variants={itemVariants} className="w-full bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <History size={14} className="text-gray-400" />
            <h2 className="text-xs font-medium text-white">Activity Heatmap <span className="text-gray-500 font-mono">(Last 90 Days)</span></h2>
          </div>
          
          <div className="grid grid-cols-[repeat(30,1fr)] grid-rows-3 gap-1.5 w-full">
            {heatmapDays.map((day, idx) => {
              const intensity = day.count === 0 ? "bg-white/[0.03]" : 
                                day.count === 1 ? "bg-white/20" : 
                                day.count === 2 ? "bg-white/50" : "bg-white";
              return (
                <div 
                  key={idx} 
                  className={`w-full aspect-square rounded-[2px] transition-colors ${intensity}`}
                  title={`${day.dateStr}: ${day.count} workouts`}
                />
              );
            })}
          </div>
        </motion.div>
      </motion.div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; height: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(68, 136, 255, 0.5); }
      `}</style>
    </div>
  );
}
