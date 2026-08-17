"use client";

import { motion } from "framer-motion";
import MusicModule from "@/components/MusicModule";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
      mass: 1
    }
  },
};

const cardHover = {
  scale: 1.02,
  transition: { type: "spring", stiffness: 400, damping: 20 }
};

export default function Home() {
  return (
    <div className="relative w-full h-full">
      
      {/* HUD Background Effects */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#ff5500]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#ffffff]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Content / Bento Grid */}
      <motion.main 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="grid grid-cols-1 lg:grid-cols-4 gap-6 auto-rows-[200px] relative z-10"
      >
        
        {/* Biometrics / Gym Module */}
        <motion.div 
          variants={itemVariants}
          whileHover={cardHover}
          className="col-span-1 lg:col-span-2 bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#1a1a1a] rounded-3xl p-6 cursor-pointer"
        >
          <h2 className="text-sm text-gray-400 mb-4">Biometrics & Recovery</h2>
          <div className="flex items-end gap-4">
            <div className="text-5xl font-mono tracking-tighter">98<span className="text-xl text-gray-500">%</span></div>
            <div className="text-sm text-gray-500 mb-1">Recovery Score</div>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 font-mono mb-1">CALORIES</div>
              <div className="text-lg font-mono">2,850</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-mono mb-1">SLEEP</div>
              <div className="text-lg font-mono">7h 42m</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-mono mb-1">WORKOUT</div>
              <div className="text-lg text-[#ff5500] font-mono">Pending</div>
            </div>
          </div>
        </motion.div>

        {/* Deep Work / University Module */}
        <motion.div 
          variants={itemVariants}
          whileHover={cardHover}
          className="col-span-1 bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#1a1a1a] rounded-3xl p-6 flex flex-col justify-between cursor-pointer"
        >
          <h2 className="text-sm text-gray-400">Deep Work</h2>
          <div className="text-4xl font-mono tracking-tighter">4.5<span className="text-lg text-gray-500">h</span></div>
          <div className="w-full bg-[#1a1a1a] h-2 rounded-full overflow-hidden">
            <div className="bg-white w-3/4 h-full" />
          </div>
        </motion.div>

        {/* Finance / Agency Module */}
        <motion.div 
          variants={itemVariants}
          whileHover={cardHover}
          className="col-span-1 bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#1a1a1a] rounded-3xl p-6 flex flex-col justify-between cursor-pointer"
        >
          <h2 className="text-sm text-gray-400">Cash Flow</h2>
          <div className="text-3xl font-mono tracking-tighter text-green-400">+$4,200</div>
          <div className="text-xs text-gray-500 font-mono">Last 7 days</div>
        </motion.div>

        {/* Second Brain / Obsidian Module */}
        <motion.div 
          variants={itemVariants}
          className="col-span-1 lg:col-span-2 row-span-2 bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#1a1a1a] rounded-3xl p-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm text-gray-400">Second Brain (Obsidian)</h2>
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" title="Synced" />
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-none">
            {[
              { title: "Resumen de reunión con cliente", time: "10 mins ago" },
              { title: "Ideas para automatización de correos", time: "2 hrs ago" },
              { title: "Rutina de hipertrofia modificada", time: "1 day ago" },
              { title: "Notas clase Arquitectura II", time: "2 days ago" },
            ].map((note, i) => (
              <motion.div key={i} whileHover={{ scale: 1.01, x: 5 }} className="flex items-center justify-between p-4 bg-black rounded-xl border border-[#1a1a1a] cursor-pointer hover:border-[#333] transition-colors">
                <span className="text-sm text-gray-300">{note.title}</span>
                <span className="text-xs font-mono text-gray-500">{note.time}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
        
        {/* Now Playing / Apple Music Module */}
        <MusicModule itemVariants={itemVariants} cardHover={cardHover} />

        {/* Shadow Actions Module */}
        <motion.div 
          variants={itemVariants}
          whileHover={cardHover}
          className="col-span-1 bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#1a1a1a] rounded-3xl p-6 cursor-pointer flex flex-col justify-center items-center group"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', metaKey: true }))}
        >
          <div className="text-gray-400 text-sm mb-4 text-center">Shadow is waiting for commands</div>
          <div className="flex gap-2">
            <kbd className="px-3 py-1.5 bg-[#1a1a1a] rounded-lg text-sm font-mono text-white group-hover:bg-[#ff5500] group-hover:text-black transition-colors">⌘</kbd>
            <kbd className="px-3 py-1.5 bg-[#1a1a1a] rounded-lg text-sm font-mono text-white group-hover:bg-[#ff5500] group-hover:text-black transition-colors">G</kbd>
          </div>
        </motion.div>

      </motion.main>

    </div>
  );
}
