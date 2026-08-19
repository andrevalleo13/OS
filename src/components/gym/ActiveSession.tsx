"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Square, Plus, X, Check, Timer } from "lucide-react";
import { DayRoutine } from "@/components/gym/MuscleData";
import { saveWorkoutSession } from "@/app/actions/gym";

interface ActiveSessionProps {
  routine: DayRoutine;
  liftHistory: Record<string, { date: string, weight: number }[]>;
  onFinish: () => void;
}

interface ExerciseSet {
  id: string;
  weight: string;
  reps: string;
  unit: 'kg' | 'lb';
  isDone: boolean;
}

interface ExerciseLog {
  id: string;
  name: string;
  muscleId: string;
  sets: ExerciseSet[];
}

export default function ActiveSession({ routine, liftHistory, onFinish }: ActiveSessionProps) {
  const [startTime] = useState(Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const [victoryData, setVictoryData] = useState<{ volume: number, prs: number, duration: number } | null>(null);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const router = useRouter();
  
  const generateId = () => Math.random().toString(36).substring(2, 9);

  const [logs, setLogs] = useState<ExerciseLog[]>(() => 
    routine.exercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      muscleId: ex.muscleId || "unknown",
      sets: [
        { id: generateId(), weight: "", reps: "", unit: 'kg', isDone: false },
        { id: generateId(), weight: "", reps: "", unit: 'kg', isDone: false }
      ]
    }))
  );

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restTimer !== null && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer(prev => prev !== null ? prev - 1 : null);
      }, 1000);
    } else if (restTimer === 0) {
      setRestTimer(null);
    }
    return () => clearInterval(interval);
  }, [restTimer]);

  const formatRestTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleUpdateLog = (exId: string, setId: string, field: 'weight' | 'reps', value: string) => {
    setLogs(prev => prev.map(log => {
      if (log.id === exId) {
        return {
          ...log,
          sets: log.sets.map(s => s.id === setId ? { ...s, [field]: value } : s)
        };
      }
      return log;
    }));
  };

  const handleToggleUnit = (exId: string, setId: string) => {
    setLogs(prev => prev.map(log => {
      if (log.id === exId) {
        return {
          ...log,
          sets: log.sets.map(s => s.id === setId ? { ...s, unit: s.unit === 'kg' ? 'lb' : 'kg' } : s)
        };
      }
      return log;
    }));
  };

  const handleToggleDone = (exId: string, setId: string) => {
    setLogs(prev => prev.map(log => {
      if (log.id === exId) {
        return {
          ...log,
          sets: log.sets.map(s => {
            if (s.id === setId) {
              const newDone = !s.isDone;
              if (newDone) {
                // Start 2 min rest timer if marked as done
                setRestTimer(120);
              }
              return { ...s, isDone: newDone };
            }
            return s;
          })
        };
      }
      return log;
    }));
  };

  const handleAddSet = (exId: string) => {
    setLogs(prev => prev.map(log => {
      if (log.id === exId) {
        const lastSet = log.sets[log.sets.length - 1];
        return {
          ...log,
          sets: [...log.sets, { 
            id: generateId(), 
            weight: lastSet?.weight || "", 
            reps: lastSet?.reps || "", 
            unit: lastSet?.unit || 'kg',
            isDone: false 
          }]
        };
      }
      return log;
    }));
  };

  const handleRemoveSet = (exId: string, setId: string) => {
    setLogs(prev => prev.map(log => {
      if (log.id === exId) {
        return {
          ...log,
          sets: log.sets.filter(s => s.id !== setId)
        };
      }
      return log;
    }));
  };

  const handleFinish = async () => {
    setIsSaving(true);
    
    let totalVolume = 0;
    let newPrs = 0;

    const finalExercises = logs.map(log => {
      const validSets = log.sets.filter(s => parseFloat(s.weight) > 0 && parseInt(s.reps) > 0);
      
      let maxWeight = 0;
      let repsArr: number[] = [];
      
      validSets.forEach(s => {
        let w = parseFloat(s.weight);
        if (s.unit === 'lb') {
          w = w / 2.20462; // Convert to kg for DB
        }
        w = parseFloat(w.toFixed(1));
        
        const r = parseInt(s.reps);
        if (w > maxWeight) maxWeight = w;
        repsArr.push(r);
        totalVolume += (w * r);
      });

      // Check if it's a new PR
      const history = liftHistory[log.name] || [];
      const previousMax = history.length > 0 ? Math.max(...history.map(h => h.weight)) : 0;
      if (maxWeight > previousMax) {
        newPrs++;
      }

      return {
        name: log.name,
        sets: validSets.length,
        reps: repsArr.join(', '),
        weight: maxWeight,
        muscleId: log.muscleId
      };
    }).filter(ex => ex.sets > 0);

    const durationMins = Math.ceil((Date.now() - startTime) / 60000);

    await saveWorkoutSession(routine.name, durationMins, totalVolume, finalExercises);
    
    setIsSaving(false);
    
    // Show victory screen
    setVictoryData({ volume: totalVolume, prs: newPrs, duration: durationMins });
    
    // Force Next.js to re-fetch Server Components data
    router.refresh();
  };

  if (victoryData) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-3xl z-50 rounded-3xl border border-white/10 flex flex-col items-center justify-center overflow-hidden p-6"
      >
        <motion.div 
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-medium text-white tracking-tight">Workout Complete</h2>
          
          <div className="flex gap-8 mt-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Volume</span>
              <span className="text-2xl font-mono text-white">{(victoryData.volume / 1000).toFixed(1)}k <span className="text-sm text-gray-500">kg</span></span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Duration</span>
              <span className="text-2xl font-mono text-white">{victoryData.duration} <span className="text-sm text-gray-500">m</span></span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">New PRs</span>
              <span className="text-2xl font-mono text-white">{victoryData.prs}</span>
            </div>
          </div>

          <button 
            onClick={onFinish}
            className="mt-12 px-8 py-3 bg-white text-black hover:bg-gray-200 rounded-full font-bold text-sm transition-colors"
          >
            Regresar al Dashboard
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-3xl z-50 rounded-3xl border border-white/10 flex flex-col overflow-hidden"
    >
      {/* Floating Rest Timer */}
      <AnimatePresence>
        {restTimer !== null && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-6 left-1/2 flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full shadow-2xl z-50"
          >
            <Timer className="w-4 h-4 text-white animate-pulse" />
            <span className="text-sm font-mono text-white font-bold">{formatRestTimer(restTimer)}</span>
            <button 
              onClick={() => setRestTimer(null)}
              className="ml-2 w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header (Ultra Minimal) */}
      <div className="flex items-center justify-between p-6 border-b border-white/[0.02] bg-transparent">
        <h2 className="text-xl font-medium text-white">{routine.name}</h2>
        <button 
          onClick={handleFinish}
          disabled={isSaving}
          className="flex items-center gap-2 bg-white text-black hover:bg-gray-200 disabled:opacity-50 px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
        >
          {isSaving ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <Square className="w-4 h-4 fill-black text-black" />}
          {isSaving ? "Guardando..." : "Finalizar"}
        </button>
      </div>

      {/* Exercises List */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-20">
          {logs.map((log, index) => {
            const history = liftHistory[log.name] || [];
            const lastLift = history.length > 0 ? history[history.length - 1] : null;

            return (
            <div key={log.id} className="bg-transparent border-b border-white/[0.05] pb-8 flex flex-col">
              <div className="flex flex-col mb-6">
                <h3 className="text-lg font-medium text-white flex items-center gap-3">
                  <span className="text-gray-500 font-mono text-sm">{index + 1}.</span>
                  {log.name}
                </h3>
                {lastLift && (
                  <span className="ml-7 mt-1 text-[11px] text-gray-500 font-mono tracking-wide">
                    Ghost: {lastLift.weight}kg <span className="text-gray-600">({lastLift.date})</span>
                  </span>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {log.sets.map((set, setIndex) => (
                    <motion.div 
                      key={set.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`grid grid-cols-12 gap-4 items-center group p-2 rounded-xl border transition-all ${set.isDone ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/5'}`}
                    >
                      <div className="col-span-1 flex items-center justify-center">
                        <button 
                          onClick={() => handleToggleDone(log.id, set.id)}
                          className={`w-6 h-6 flex items-center justify-center rounded-md border ${set.isDone ? 'bg-white text-black border-white' : 'bg-transparent text-transparent border-white/20 hover:border-white/50'} transition-all`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="col-span-5 relative group/input">
                        <div className={`absolute inset-y-0 right-2 flex items-center ${set.weight ? 'opacity-100' : 'opacity-0'} group-hover/input:opacity-100 transition-opacity`}>
                          <button 
                            onClick={() => handleToggleUnit(log.id, set.id)}
                            className="text-[10px] font-mono font-bold bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"
                          >
                            {set.unit.toUpperCase()}
                          </button>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Weight"
                          value={set.weight}
                          onChange={(e) => handleUpdateLog(log.id, set.id, 'weight', e.target.value)}
                          className="w-full bg-black/40 text-white font-mono text-center text-lg py-3 rounded-xl border border-white/5 focus:border-white/20 focus:bg-white/[0.04] outline-none placeholder:text-gray-700 transition-all" 
                          disabled={set.isDone}
                        />
                      </div>
                      
                      <div className="col-span-5">
                        <input 
                          type="number" 
                          placeholder="Reps"
                          value={set.reps}
                          onChange={(e) => handleUpdateLog(log.id, set.id, 'reps', e.target.value)}
                          className="w-full bg-black/40 text-white font-mono text-center text-lg py-3 rounded-xl border border-white/5 focus:border-white/20 focus:bg-white/[0.04] outline-none placeholder:text-gray-700 transition-all" 
                          disabled={set.isDone}
                        />
                      </div>

                      <div className="col-span-1 flex items-center justify-center">
                        <button 
                          onClick={() => handleRemoveSet(log.id, set.id)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                          disabled={set.isDone}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div className="grid grid-cols-12 gap-4 mt-2">
                  <div className="col-span-1"></div>
                  <div className="col-span-10">
                    <button 
                      onClick={() => handleAddSet(log.id)}
                      className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-mono text-gray-500 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-all border-dashed"
                    >
                      <Plus className="w-3 h-3" /> Add Set
                    </button>
                  </div>
                  <div className="col-span-1"></div>
                </div>

              </div>
            </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
