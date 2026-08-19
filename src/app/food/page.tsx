import { getDailyMacros, getMonthlyHistory } from "@/app/actions/nutrition";
import NutritionDashboard from "@/components/food/NutritionDashboard";

export default async function FoodPage() {
  const { totals, logs } = await getDailyMacros();
  const monthlyHistory = await getMonthlyHistory();

  return (
    <div className="w-full h-full p-8 md:p-12 overflow-y-auto custom-scrollbar">
      <NutritionDashboard dailyTotals={totals} logs={logs} monthlyHistory={monthlyHistory} />
    </div>
  );
}
