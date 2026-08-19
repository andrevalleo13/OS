import GymDashboard from "@/components/gym/GymDashboard";
import { getGymData } from "@/app/actions/gym";

export default async function GymPage() {
  const { sessionHistory, personalRecords, muscleStats, liftHistory, lifetimeVolume, totalWorkouts, heatmap, currentWeight } = await getGymData();

  return (
    <GymDashboard 
      sessionHistory={sessionHistory} 
      personalRecords={personalRecords} 
      muscleStats={muscleStats}
      liftHistory={liftHistory}
      lifetimeVolume={lifetimeVolume}
      totalWorkouts={totalWorkouts}
      heatmap={heatmap}
      currentWeight={currentWeight}
    />
  );
}
