import { connection } from "next/server";
import { getUniversityOverview, seedUniversityData } from "@/app/actions/university";
import UniversityDashboard from "@/components/uni/UniversityDashboard";

export default async function UniversityPage() {
  // La bóveda y la base se leen en cada petición: nada de esta página se prerenderiza.
  await connection();
  await seedUniversityData().catch((error: unknown) => console.error("Universidad: no se pudo preparar la base:", error));
  const overview = await getUniversityOverview();
  return <UniversityDashboard overview={overview} />;
}
