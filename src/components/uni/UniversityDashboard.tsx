"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { containerVariants, itemVariants } from "@/lib/animations";
import { GraduationCap, BookOpen, Clock, AlertCircle, Sparkles, ChevronRight, Terminal } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
// Calculator is now pure math, no server action needed

export default function UniversityDashboard({ courses, assignments }: { courses: any[], assignments: any[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Semester Progress calculations
  const semStart = new Date("2026-08-01").getTime();
  const semEnd = new Date("2026-12-15").getTime();
  const now = new Date().getTime();
  const semProgress = Math.min(Math.max(((now - semStart) / (semEnd - semStart)) * 100, 0), 100);

  // Radar Data
  const radarData = courses.map(c => ({
    subject: c.name.substring(0, 15) + (c.name.length > 15 ? '...' : ''),
    grade: c.currentGrade || 0,
    fullMark: 100,
  }));

  // Assignments Matrix
  const pendingAssignments = assignments.filter(a => a.status !== "done").sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <motion.div 
      className="flex flex-col gap-8 w-full max-w-7xl mx-auto pb-24"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header & Semester Hourglass */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 border-b border-[#222] pb-6">
        <div className="flex items-center gap-2 text-gray-500 font-mono text-xs uppercase tracking-widest">
          <GraduationCap className="w-4 h-4" />
          <span>Centro de Comando Académico</span>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[10px] font-mono text-gray-400">
            <span>Inicio de Semestre (Ago)</span>
            <span>Progreso Total: {semProgress.toFixed(1)}%</span>
            <span>Finales (Dic)</span>
          </div>
          <div className="w-full h-[2px] bg-[#111] rounded-full overflow-hidden relative">
            <motion.div 
              className="absolute top-0 left-0 bottom-0 bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${semProgress}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Radar & Shadow Tutor */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Performance Radar */}
          <motion.div variants={itemVariants} className="bg-[#000] border border-[#111] rounded-xl p-5 flex flex-col items-center">
            <h3 className="text-[10px] text-gray-500 font-mono uppercase tracking-widest w-full text-left mb-2">Radar de Desempeño</h3>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#222" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 9, fontFamily: 'monospace' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="GPA" dataKey="grade" stroke="#fff" fill="#ffffff" fillOpacity={0.1} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Shadow Tutor */}
          <motion.div variants={itemVariants} className="bg-[#000] border border-[#111] rounded-xl p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-900/20 to-transparent blur-xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-[10px] text-purple-400/80 font-mono uppercase tracking-widest">Calculadora de Calificaciones</h3>
            </div>
            <GradeCalculator courses={courses} />
          </motion.div>
        </div>

        {/* Right Col: Course Grid & Matrix */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Courses Grid */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map(course => {
              const maxAbsences = course.maxAbsences || 6;
              const absences = course.absences || 0;
              const isDanger = absences >= maxAbsences;
              const isWarning = absences >= maxAbsences - 1;

              return (
                <div 
                  key={course.id} 
                  className={`bg-[#000] border ${isDanger ? 'border-red-900/50 shadow-[0_0_15px_rgba(220,38,38,0.1)]' : 'border-[#111] hover:border-[#333]'} rounded-xl p-4 flex flex-col gap-3 transition-all relative overflow-hidden group`}
                >
                  <div className="absolute top-0 left-0 w-[2px] h-full opacity-50 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: course.color }} />
                  
                  <div className="flex justify-between items-start pl-2">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-200 font-medium">{course.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono mt-1">{course.professor}</span>
                    </div>
                    <span className="text-lg font-mono tracking-tighter" style={{ color: course.color }}>{course.currentGrade}%</span>
                  </div>
                  
                  {/* Absences Dot Track */}
                  <div className="pl-2 flex flex-col gap-1.5 mt-2">
                    <div className="flex justify-between items-center">
                      <span className={`text-[9px] font-mono uppercase tracking-widest ${isDanger ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-gray-600'}`}>
                        Faltas ({absences}/{maxAbsences})
                      </span>
                      {isDanger && <AlertCircle className="w-3 h-3 text-red-500" />}
                    </div>
                    <div className="flex gap-1">
                      {Array.from({ length: maxAbsences }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 h-1 rounded-full ${i < absences ? (isDanger ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-orange-500') : 'bg-[#1a1a1a]'}`} 
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pl-2 mt-2 flex items-center gap-2 text-[10px] text-gray-500 font-mono pt-3 border-t border-[#111]">
                    <Clock className="w-3 h-3" />
                    {course.schedule}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Kanban Matrix */}
          <motion.div variants={itemVariants} className="bg-[#000] border border-[#111] rounded-xl p-5 flex flex-col flex-1">
            <div className="flex items-center gap-2 mb-6">
              <Terminal className="w-4 h-4 text-gray-500" />
              <h3 className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Matriz de Entregables</h3>
            </div>
            
            <div className="flex flex-col gap-3">
              {pendingAssignments.length === 0 ? (
                <div className="text-xs text-gray-600 font-mono text-center py-8">No hay entregas pendientes.</div>
              ) : (
                pendingAssignments.map(assignment => {
                  const hoursUntil = (new Date(assignment.dueDate).getTime() - now) / 36e5;
                  const isUrgent = hoursUntil <= 48 && hoursUntil > 0;
                  const isOverdue = hoursUntil <= 0;
                  
                  return (
                    <div 
                      key={assignment.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border ${isUrgent ? 'border-[#ff5500]/50 bg-[#ff5500]/5' : isOverdue ? 'border-red-900/50 bg-red-900/10' : 'border-[#1a1a1a] bg-[#111]/50'} transition-colors`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-medium ${isUrgent ? 'text-[#ff5500]' : isOverdue ? 'text-red-500' : 'text-gray-300'}`}>
                          {assignment.title}
                        </span>
                        <span className="text-[9px] font-mono text-gray-500">
                          {assignment.course.name} • Vale {assignment.weight}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-mono ${isUrgent ? 'text-[#ff5500]' : 'text-gray-500'}`}>
                          {mounted ? new Date(assignment.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : "..."}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}

function GradeCalculator({ courses }: { courses: any[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [target, setTarget] = useState("90");
  const [remaining, setRemaining] = useState("100");

  const course = courses.find(c => c.id === courseId);
  const currentGrade = course?.currentGrade || 0;
  const targetNum = parseFloat(target) || 0;
  const remainingNum = parseFloat(remaining) || 0;

  // Matemática pura: ¿cuánto necesitas sacar en lo que falta?
  const requiredGrade = remainingNum > 0 
    ? (targetNum - (currentGrade * (100 - remainingNum) / 100)) / (remainingNum / 100)
    : 0;

  const isPossible = requiredGrade <= 100;
  const isEasy = requiredGrade < 70;
  const alreadyPassed = requiredGrade <= 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Materia</label>
        <select 
          value={courseId} 
          onChange={e => setCourseId(e.target.value)}
          className="bg-[#0a0a0a] border border-[#1a1a1a] text-gray-300 text-xs rounded-lg p-2 focus:outline-none focus:border-[#333] transition-colors"
        >
          {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.currentGrade}%)</option>)}
        </select>
      </div>
      <div className="flex gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Quiero sacar</label>
          <input 
            type="number" 
            value={target}
            onChange={e => setTarget(e.target.value)}
            className="bg-[#0a0a0a] border border-[#1a1a1a] text-gray-300 text-xs rounded-lg p-2 focus:outline-none focus:border-[#333] transition-colors"
            placeholder="90"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">% que falta</label>
          <input 
            type="number" 
            value={remaining}
            onChange={e => setRemaining(e.target.value)}
            className="bg-[#0a0a0a] border border-[#1a1a1a] text-gray-300 text-xs rounded-lg p-2 focus:outline-none focus:border-[#333] transition-colors"
            placeholder="30"
          />
        </div>
      </div>
      
      {/* Resultado instantáneo */}
      <div className={`mt-2 p-4 rounded-lg border ${alreadyPassed ? 'border-green-900/50 bg-green-900/5' : isPossible ? 'border-[#1a1a1a] bg-[#0a0a0a]' : 'border-red-900/50 bg-red-900/5'}`}>
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Necesitas sacar</span>
          <span className={`text-2xl font-mono font-bold tracking-tighter ${alreadyPassed ? 'text-green-400' : isPossible ? (isEasy ? 'text-green-400' : 'text-white') : 'text-red-500'}`}>
            {alreadyPassed ? "✓" : requiredGrade.toFixed(1)}
          </span>
        </div>
        <p className="text-[10px] font-mono text-gray-500 mt-2">
          {alreadyPassed 
            ? "Ya tienes la calificación asegurada. Relájate." 
            : isPossible 
              ? `en el ${remainingNum}% restante para llegar a ${targetNum} final.`
              : `Matemáticamente imposible. Necesitas más de 100 en lo que falta.`
          }
        </p>
      </div>
    </div>
  );
}
