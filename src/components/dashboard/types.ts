export type DashboardTransaction = {
  id: string;
  amount: number;
  type: string;
  category: string;
  note: string | null;
  date: string;
};

export type DashboardFinance = {
  transactions: DashboardTransaction[];
  balance: number;
  spentThisWeek: number;
  incomeThisWeek: number;
};

export type DashboardBiometrics = {
  latest: { weight: number | null; sleep: number | null; hrv: number | null; steps: number | null };
  averages: { weight: number | null; sleep: number | null; hrv: number | null; steps: number | null };
  readiness: number;
};

export type DashboardNutrition = {
  totals: { calories: number; protein: number; carbs: number; fat: number; water: number };
  logs: Array<{
    id: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    water: number;
    date: string;
  }>;
};

export type DashboardAssignment = {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  course: { id: string; name: string };
};

export type DashboardGym = {
  totalWorkouts: number;
  lifetimeVolume: number;
  currentWeight: number;
  sessionHistory: Array<{
    id: string;
    date: string;
    routineName: string;
    duration: string;
    totalVolume: number;
  }>;
};

export type DashboardNote = { name: string; content: string };

export type DashboardInitialData = {
  finance: DashboardFinance;
  biometrics: DashboardBiometrics;
  nutrition: DashboardNutrition;
  assignments: DashboardAssignment[];
  gym: DashboardGym;
  notes: DashboardNote[];
};
