import { getDailyMacros, getConsistencyHistory } from "@/app/actions/nutrition";
import NutritionDashboard from "@/components/food/NutritionDashboard";
import { NUTRITION_GOALS, normalizeStoredBreakdown } from "@/features/nutrition/nutrition";
import { serverConfig } from "@/lib/config";
import { connection } from "next/server";

export default async function FoodPage() {
  await connection();
  const [{ totals, logs }, monthlyHistory] = await Promise.all([
    getDailyMacros(),
    getConsistencyHistory(),
  ]);
  const serializedLogs = logs.map((log) => ({
    ...log,
    date: log.date.toISOString(),
    breakdown: normalizeStoredBreakdown(log.breakdown),
  }));

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-5 custom-scrollbar md:px-8 md:py-8">
      <NutritionDashboard
        dailyTotals={totals}
        goals={NUTRITION_GOALS}
        logs={serializedLogs}
        monthlyHistory={monthlyHistory}
        timezone={serverConfig.timezone}
      />
    </div>
  );
}
