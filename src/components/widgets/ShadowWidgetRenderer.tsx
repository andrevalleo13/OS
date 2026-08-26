import React from "react";
import { motion } from "framer-motion";

function AgendaWidget() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/5 border border-white/10 rounded-2xl p-5 mt-4 w-full max-w-sm backdrop-blur-md"
    >
      <h3 className="text-white/80 font-medium mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-white/50"></span>
        Agenda del Día
      </h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/60">09:00 AM</span>
          <span className="text-white">Revisar correos</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/60">12:30 PM</span>
          <span className="text-white">Gym - Push Day</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/60">03:00 PM</span>
          <span className="text-white">Junta con equipo</span>
        </div>
      </div>
    </motion.div>
  );
}

function StatsWidget() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/5 border border-white/10 rounded-2xl p-5 mt-4 w-full max-w-sm backdrop-blur-md"
    >
      <h3 className="text-white/80 font-medium mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-white/50"></span>
        Estadísticas Diarias
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black/20 rounded-xl p-3 flex flex-col items-center">
          <span className="text-white/50 text-xs uppercase tracking-wider mb-1">Pasos</span>
          <span className="text-2xl font-light text-white">8,432</span>
        </div>
        <div className="bg-black/20 rounded-xl p-3 flex flex-col items-center">
          <span className="text-white/50 text-xs uppercase tracking-wider mb-1">Agua</span>
          <span className="text-2xl font-light text-white">1.5L</span>
        </div>
        <div className="bg-black/20 rounded-xl p-3 flex flex-col items-center col-span-2">
          <span className="text-white/50 text-xs uppercase tracking-wider mb-1">Productividad</span>
          <div className="w-full bg-white/10 h-2 rounded-full mt-2 overflow-hidden">
            <div className="h-full w-[75%] rounded-full bg-white/55"></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ShadowWidgetRenderer({ widget }: { widget?: string }) {
  if (!widget || widget === "none") return null;

  switch (widget) {
    case "agenda":
      return <AgendaWidget />;
    case "stats":
      return <StatsWidget />;
    default:
      return null;
  }
}
