"use client";

import { motion } from "framer-motion";
import MusicModule from "@/components/MusicModule";
import { WidgetBackdrop, WidgetProvider } from "@/components/ui/widget";
import AgendaWidget from "@/components/widgets/AgendaWidget";
import BiometricsWidget from "@/components/widgets/BiometricsWidget";
import FinanceWidget from "@/components/widgets/FinanceWidget";
import GymWidget from "@/components/widgets/GymWidget";
import NutritionWidget from "@/components/widgets/NutritionWidget";
import QuickNotesWidget from "@/components/widgets/QuickNotesWidget";
import ShadowWidget from "@/components/widgets/ShadowWidget";
import UniversityWidget from "@/components/widgets/UniversityWidget";
import type { DashboardInitialData } from "./types";

export default function DashboardHome({ initialData }: { initialData: DashboardInitialData }) {
  return (
    <WidgetProvider>
      <WidgetBackdrop />
      <div className="os-page relative mx-auto min-h-[100dvh] w-full max-w-[1400px] py-3 text-[#eeeeee] md:py-5">
        <div className="pointer-events-none absolute right-[8%] top-[-80px] h-[360px] w-[620px] rounded-full bg-white/[0.018] blur-[120px]" />
        <motion.main
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 grid w-full grid-cols-1 gap-3 md:grid-cols-6 xl:grid-cols-12"
        >
          <ShadowWidget />
          <AgendaWidget />
          <QuickNotesWidget initialNotes={initialData.notes} />
          <FinanceWidget initialData={initialData.finance} />
          <BiometricsWidget initialData={initialData.biometrics} />
          <GymWidget initialData={initialData.gym} />
          <NutritionWidget initialData={initialData.nutrition} />
          <UniversityWidget initialAssignments={initialData.assignments} />
          <MusicModule />
        </motion.main>
      </div>
    </WidgetProvider>
  );
}
