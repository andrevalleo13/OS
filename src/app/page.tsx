import { getTransactions } from "@/actions/finance";
import { getBiometricOverview } from "@/app/actions/biometrics";
import { getGymData } from "@/app/actions/gym";
import { getDailyMacros } from "@/app/actions/nutrition";
import { getRecentNotes } from "@/app/actions/obsidian";
import { getAssignments } from "@/app/actions/university";
import DashboardHome from "@/components/dashboard/DashboardHome";
import type { DashboardInitialData } from "@/components/dashboard/types";

const emptyData: DashboardInitialData = {
  finance: { transactions: [], balance: 4_200, spentThisWeek: 0, incomeThisWeek: 0 },
  biometrics: {
    latest: { weight: null, sleep: null, hrv: null, steps: null },
    averages: { weight: null, sleep: null, hrv: null, steps: null },
    readiness: 60,
  },
  nutrition: { totals: { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 }, logs: [] },
  assignments: [],
  gym: { totalWorkouts: 0, lifetimeVolume: 0, currentWeight: 62, sessionHistory: [] },
  notes: [],
};

const emptyFinanceSource: Awaited<ReturnType<typeof getTransactions>> = {
  transactions: [],
  balance: 4_200,
  spentThisWeek: 0,
  incomeThisWeek: 0,
};

const emptyNutritionSource: Awaited<ReturnType<typeof getDailyMacros>> = {
  totals: emptyData.nutrition.totals,
  logs: [],
};

async function safely<T>(request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request;
  } catch (error) {
    console.error("Dashboard source unavailable:", error);
    return fallback;
  }
}

export default async function Home() {
  const [finance, biometrics, nutrition, assignments, gym, notes] = await Promise.all([
    safely(getTransactions(), emptyFinanceSource),
    safely(getBiometricOverview(), { ...emptyData.biometrics, logs: [] }),
    safely(getDailyMacros(), emptyNutritionSource),
    safely(getAssignments(), []),
    safely(getGymData(), { ...emptyData.gym, personalRecords: [], muscleStats: {}, liftHistory: {}, heatmap: {} }),
    safely(getRecentNotes(5), emptyData.notes),
  ]);

  const initialData: DashboardInitialData = {
    finance: {
      ...finance,
      transactions: finance.transactions.map((transaction) => ({ ...transaction, date: transaction.date.toISOString() })),
    },
    biometrics: { latest: biometrics.latest, averages: biometrics.averages, readiness: biometrics.readiness },
    nutrition: {
      totals: nutrition.totals,
      logs: nutrition.logs.map((log) => ({ ...log, date: log.date.toISOString() })),
    },
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      dueDate: assignment.dueDate.toISOString(),
      status: assignment.status,
      course: { id: assignment.course.id, name: assignment.course.name },
    })),
    gym: {
      totalWorkouts: gym.totalWorkouts,
      lifetimeVolume: gym.lifetimeVolume,
      currentWeight: gym.currentWeight,
      sessionHistory: gym.sessionHistory,
    },
    notes,
  };

  return <DashboardHome initialData={initialData} />;
}
