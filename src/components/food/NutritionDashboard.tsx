"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, Utensils, Flame, Droplets, Wheat, History, Egg, Terminal, Sparkles, ChevronDown } from "lucide-react";
import { logFood, logWater, getShadowMacroAdvice } from "@/app/actions/nutrition";
import { containerVariants, itemVariants } from "@/lib/animations";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function NutritionDashboard({ dailyTotals, logs, monthlyHistory }: { dailyTotals: any, logs: any[], monthlyHistory?: any }) {
  const [input, setInput] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLogging(true);
    setError(null);
    try {
      await logFood(input);
      setInput("");
    } catch (err: any) {
      setError(err.message || "Failed to log food");
      setIsLogging(false);
    }
  };

  const handleWaterSubmit = async (amount: number) => {
    try {
      await logWater(amount);
    } catch (err) {
      console.error(err);
    }
  };

  const MACRO_GOALS = {
    calories: 2850,
    protein: 135,
    carbs: 365,
    fat: 95,
    water: 3.0
  };

  const getProgress = (current: number, goal: number) => {
    const progress = (current / goal) * 100;
    return progress > 100 ? 100 : progress;
  };

  const chartData = logs.slice().reverse().map(log => ({
    time: new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    calories: log.calories,
  }));

  return (
    <motion.div 
      className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex justify-between items-end border-b border-[#222] pb-4">
        <div>
          <h1 className="text-xs text-gray-500 font-mono tracking-[0.2em] uppercase mb-1">Protocolo de Nutrición</h1>
          <div className="text-xs text-gray-400 font-mono">
            Meta: <span className="text-white">{MACRO_GOALS.calories} kcal</span>
          </div>
        </div>
      </motion.div>

      {/* Terminal Input */}
      <motion.div variants={itemVariants} className="relative group">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <div className="absolute left-4 text-gray-500">
            <Utensils className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Registrar comida (ej. '2 huevos, pan tostado y café')..."
            className="w-full bg-transparent border border-[#222] rounded-xl py-4 pl-12 pr-12 text-sm text-gray-200 placeholder:text-[#555] focus:outline-none focus:border-[#444] transition-colors font-mono"
            disabled={isLogging}
          />
          <button 
            type="submit" 
            disabled={isLogging || !input.trim()}
            className="absolute right-3 p-2 bg-white text-black rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:bg-[#222] disabled:text-gray-500 transition-colors flex items-center justify-center"
          >
            {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </form>
        {error && <p className="text-red-500 text-xs mt-2 font-mono ml-4">{error}</p>}
      </motion.div>

      {/* Macro Rings */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MacroCard 
          title="Calorías" 
          icon={<Flame className="w-3.5 h-3.5 text-gray-500" />}
          current={dailyTotals.calories} 
          goal={MACRO_GOALS.calories} 
          unit="kcal"
          color="stroke-white"
        />
        <MacroCard 
          title="Proteína" 
          icon={<Utensils className="w-3.5 h-3.5 text-gray-500" />}
          current={dailyTotals.protein} 
          goal={MACRO_GOALS.protein} 
          unit="g"
          color="stroke-white"
        />
        <MacroCard 
          title="Carbohidratos" 
          icon={<Wheat className="w-3.5 h-3.5 text-gray-500" />}
          current={dailyTotals.carbs} 
          goal={MACRO_GOALS.carbs} 
          unit="g"
          color="stroke-white"
        />
        <MacroCard 
          title="Grasas" 
          icon={<Egg className="w-3.5 h-3.5 text-gray-500" />}
          current={dailyTotals.fat} 
          goal={MACRO_GOALS.fat} 
          unit="g"
          color="stroke-white"
        />
        <WaterCard 
          current={dailyTotals.water || 0}
          goal={MACRO_GOALS.water}
          onAdd={handleWaterSubmit}
        />
      </motion.div>

      {/* Shadow Advice */}
      <motion.div variants={itemVariants}>
        <ShadowAdvice current={dailyTotals} goal={MACRO_GOALS} />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Logs */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-gray-500" />
            <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Registro de Hoy</h2>
          </div>
          
          <div className="space-y-3">
            <AnimatePresence>
              {logs.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="p-8 border border-dashed border-[#222] rounded-xl flex items-center justify-center text-xs text-gray-500 font-mono"
                >
                  No hay comidas registradas hoy.
                </motion.div>
              ) : (
                logs.map((log: any) => (
                  <FoodLogItem key={log.id} log={log} />
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Right Column: Charts & Heatmap */}
        <motion.div variants={itemVariants} className="flex flex-col gap-6">
          {/* Area Chart */}
          <div className="bg-transparent border border-[#222] rounded-xl p-5">
            <h3 className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-4">Picos de Energía</h3>
            <div className="h-40 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#333" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', fontSize: '10px', fontFamily: 'monospace' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="calories" stroke="#fff" strokeWidth={1} fillOpacity={1} fill="url(#colorCal)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-600 font-mono">Sin datos</div>
              )}
            </div>
          </div>

          {/* Consistency Heatmap */}
          <ConsistencyHeatmap history={monthlyHistory} goal={MACRO_GOALS.calories} />
        </motion.div>
      </div>
    </motion.div>
  );
}

function MacroCard({ title, icon, current, goal, unit, color }: any) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min((current / goal) * 100, 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="bg-transparent border border-[#222] rounded-xl p-5 flex flex-col items-center relative overflow-hidden group">
      <div className="absolute top-4 left-4">{icon}</div>
      <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-4">{title}</div>
      
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle
            className="stroke-[#111]"
            strokeWidth="2"
            fill="transparent"
            r={radius}
            cx="48"
            cy="48"
          />
          <circle
            className={color}
            strokeWidth="2"
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="48"
            cy="48"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
              transition: "stroke-dashoffset 1s ease-in-out"
            }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-lg font-mono text-gray-200">{Math.round(current)}</span>
          <span className="text-[9px] text-gray-600 font-mono">{unit}</span>
        </div>
      </div>
      
      <div className="mt-3 text-[10px] text-gray-600 font-mono">
        / {goal} {unit}
      </div>
    </div>
  );
}

function WaterCard({ current, goal, onAdd }: any) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min((current / goal) * 100, 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="bg-transparent border border-[#222] rounded-xl p-5 flex flex-col items-center relative overflow-hidden group">
      <div className="absolute top-4 left-4"><Droplets className="w-3.5 h-3.5 text-blue-500/50" /></div>
      <div className="text-[10px] text-blue-500/70 font-mono uppercase tracking-widest mb-4">Agua</div>
      
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle
            className="stroke-[#111]"
            strokeWidth="2"
            fill="transparent"
            r={radius}
            cx="48"
            cy="48"
          />
          <circle
            className="stroke-blue-500"
            strokeWidth="2"
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="48"
            cy="48"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
              transition: "stroke-dashoffset 1s ease-in-out"
            }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-lg font-mono text-blue-400">{current.toFixed(1)}</span>
          <span className="text-[9px] text-blue-500/50 font-mono">Litros</span>
        </div>
      </div>
      
      <div className="mt-4 flex gap-2 w-full">
        <button onClick={() => onAdd(0.25)} className="flex-1 bg-[#111] hover:bg-[#222] text-gray-400 text-[10px] font-mono py-1.5 rounded transition-colors border border-[#222]">
          + 250ml
        </button>
        <button onClick={() => onAdd(0.5)} className="flex-1 bg-[#111] hover:bg-[#222] text-gray-400 text-[10px] font-mono py-1.5 rounded transition-colors border border-[#222]">
          + 500ml
        </button>
      </div>
    </div>
  );
}

function ShadowAdvice({ current, goal }: any) {
  const [advice, setAdvice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getShadowMacroAdvice(current, goal).then((res) => {
      if (mounted && res) setAdvice(res);
    });
    return () => { mounted = false; };
  }, [current, goal]);

  if (!advice) return null;

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group">
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff5500] to-purple-600 flex items-center justify-center shrink-0 blur-[2px] opacity-80" />
      <div className="absolute left-4 w-8 h-8 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Shadow</span>
        <span className="text-xs text-gray-300 font-mono">{advice}</span>
      </div>
    </div>
  );
}

function ConsistencyHeatmap({ history, goal }: { history: Record<string, number>, goal: number }) {
  if (!history) return null;
  
  const days = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const cals = history[dateStr] || 0;
    
    let color = 'bg-[#111] border-[#222]'; // Missed
    if (cals > 0) {
      if (cals >= goal * 0.9 && cals <= goal * 1.1) {
        color = 'bg-white border-white'; // Perfect
      } else if (cals > goal * 1.1) {
        color = 'bg-[#ff5500] border-[#ff5500]'; // Over
      } else {
        color = 'bg-[#333] border-[#444]'; // Under but logged
      }
    }
    
    days.push(
      <div key={dateStr} className={`w-3 h-3 rounded-sm border ${color}`} title={`${dateStr}: ${Math.round(cals)} kcal`} />
    );
  }

  return (
    <div className="bg-transparent border border-[#222] rounded-xl p-5">
      <h3 className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-4">Consistencia (30 Días)</h3>
      <div className="flex flex-wrap gap-1">
        {days}
      </div>
      <div className="flex items-center gap-3 mt-4 text-[9px] font-mono text-gray-500">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-[1px] bg-[#111] border border-[#222]" /> Nada</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-[1px] bg-[#333] border border-[#444]" /> Deficit</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-[1px] bg-white border border-white" /> Perfecto</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-[1px] bg-[#ff5500] border border-[#ff5500]" /> Exceso</div>
      </div>
    </div>
  );
}

function FoodLogItem({ log }: { log: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-transparent border border-[#222] rounded-xl overflow-hidden transition-colors hover:border-[#444]"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 cursor-default relative">
        <div className="z-10">
          <div className="text-sm text-gray-200 mb-1">{log.description}</div>
          <div className="text-[10px] text-gray-500 font-mono flex items-center gap-2">
            {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {log.breakdown && log.breakdown.length > 0 && (
              <span className="flex items-center gap-1 text-[#444]"><Terminal className="w-3 h-3" /> Desglose IA</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono z-10">
          <div className="text-gray-300">{Math.round(log.calories)} kcal</div>
          <div className="text-gray-500">{Math.round(log.protein)}g P</div>
          <div className="text-gray-500">{Math.round(log.carbs)}g C</div>
          <div className="text-gray-500">{Math.round(log.fat)}g F</div>
          {log.water > 0 && <div className="text-blue-400">{log.water.toFixed(1)}L H₂O</div>}
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && log.breakdown && log.breakdown.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#1a1a1a] bg-[#0a0a0a]/50"
          >
            <div className="p-4 font-mono text-[10px] text-gray-400">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-600">
                    <th className="font-normal pb-2">Ingrediente</th>
                    <th className="font-normal pb-2">Kcal</th>
                    <th className="font-normal pb-2">Pro</th>
                    <th className="font-normal pb-2">Carb</th>
                    <th className="font-normal pb-2">Grasa</th>
                  </tr>
                </thead>
                <tbody>
                  {log.breakdown.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-[#1a1a1a] last:border-0">
                      <td className="py-1 text-gray-300">{item.name}</td>
                      <td className="py-1">{item.calories}</td>
                      <td className="py-1">{item.protein}</td>
                      <td className="py-1">{item.carbs}</td>
                      <td className="py-1">{item.fat}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
