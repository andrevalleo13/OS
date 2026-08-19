"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import MusicModule from "@/components/MusicModule";
import ShadowWidget from "@/components/widgets/ShadowWidget";
import GymWidget from "@/components/widgets/GymWidget";
import AgendaWidget from "@/components/widgets/AgendaWidget";
import QuickNotesWidget from "@/components/widgets/QuickNotesWidget";
import FinanceWidget from "@/components/widgets/FinanceWidget";
import { containerVariants, itemVariants, cardHover } from "@/lib/animations";

import { WidgetProvider, WidgetBackdrop } from "@/components/ui/widget";

export default function Home() {
  const [timeOfDay, setTimeOfDay] = useState("morning");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setTimeOfDay("morning");
    else if (hour >= 12 && hour < 18) setTimeOfDay("afternoon");
    else if (hour >= 18 && hour < 22) setTimeOfDay("evening");
    else setTimeOfDay("night");
  }, []);

  return (
    <WidgetProvider>
      <WidgetBackdrop />
      <div className="relative w-full h-full min-h-screen bg-black text-[#ededed] p-4 md:p-8 selection:bg-white/20">
      
      {/* Linear-style Ambient Glow (Very subtle grayscale radial gradient at the top) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-white/[0.02] rounded-full blur-[100px] pointer-events-none" />

      {/* Main Content / Bento Grid */}
      <motion.main 
        layout
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="w-full grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 auto-rows-[auto] relative z-10"
      >
        
        {/* The JARVIS Core - Always top and spans full width */}
        <ShadowWidget />

        {/* Dynamic Layout based on Time of Day */}
        {timeOfDay === "morning" && (
          <>
            <GymWidget itemVariants={itemVariants} />
            <AgendaWidget itemVariants={itemVariants} />
            <QuickNotesWidget itemVariants={itemVariants} />
            <FinanceWidget itemVariants={itemVariants} />
            <MusicModule itemVariants={itemVariants} cardHover={{ y: -2 }} />
          </>
        )}

        {timeOfDay === "afternoon" && (
          <>
            <AgendaWidget itemVariants={itemVariants} />
            <QuickNotesWidget itemVariants={itemVariants} />
            <FinanceWidget itemVariants={itemVariants} />
            <GymWidget itemVariants={itemVariants} />
            <MusicModule itemVariants={itemVariants} cardHover={{ y: -2 }} />
          </>
        )}

        {timeOfDay === "evening" && (
          <>
            <MusicModule itemVariants={itemVariants} cardHover={{ y: -2 }} />
            <QuickNotesWidget itemVariants={itemVariants} />
            <FinanceWidget itemVariants={itemVariants} />
            <AgendaWidget itemVariants={itemVariants} />
            <GymWidget itemVariants={itemVariants} />
          </>
        )}

        {timeOfDay === "night" && (
          <>
            <MusicModule itemVariants={itemVariants} cardHover={{ y: -2 }} />
            <QuickNotesWidget itemVariants={itemVariants} />
            <AgendaWidget itemVariants={itemVariants} />
            <FinanceWidget itemVariants={itemVariants} />
            <GymWidget itemVariants={itemVariants} />
          </>
        )}

      </motion.main>
    </div>
    </WidgetProvider>
  );
}
