import GymDashboard from "@/components/gym/GymDashboard";
import { WEEKLY_ROUTINES } from "@/components/gym/MuscleData";
import { buildGymView, routineFromTemplate } from "@/components/gym/lib/derive";
import { serverConfig } from "@/lib/config";
import { dateKey } from "@/lib/dates";
import { EMPTY_HISTORY, readGymHistory } from "./_lib/history";
import { readGymVault } from "./_lib/vault";

// La bóveda y la base se leen en cada visita: nada de contenido congelado en el build.
export const dynamic = "force-dynamic";

function todayKey(): string {
  return dateKey(new Date(), serverConfig.timezone);
}

export default async function GymPage() {
  const [history, vault] = await Promise.all([
    readGymHistory().catch((error: unknown) => {
      console.error("[gym] Base de datos no disponible:", error);
      return EMPTY_HISTORY;
    }),
    readGymVault().catch((error: unknown) => {
      console.error("[gym] No se pudo leer la bóveda:", error);
      return null;
    }),
  ]);

  const view = buildGymView({
    todayKey: todayKey(),
    history,
    vault,
    fallbackRoutine: routineFromTemplate(WEEKLY_ROUTINES),
  });

  return <GymDashboard view={view} />;
}
