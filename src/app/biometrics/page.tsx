import { getBiometricOverview } from "@/app/actions/biometrics";
import BiometricsDashboard from "@/components/biometrics/BiometricsDashboard";

export default async function BiometricsPage() {
  const overview = await getBiometricOverview();
  return <BiometricsDashboard initialData={{ ...overview, logs: overview.logs.map((log) => ({ ...log, date: log.date.toISOString() })) }} />;
}
