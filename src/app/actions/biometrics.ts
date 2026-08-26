"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { biometricAverages, biometricReadiness } from "@/features/biometrics/biometrics.service";

const biometricInput = z.object({
  weight: z.number().finite().min(25).max(350).optional(),
  sleep: z.number().finite().min(0).max(24).optional(),
  hrv: z.number().int().min(1).max(300).optional(),
  steps: z.number().int().min(0).max(200000).optional(),
}).refine((value) => Object.values(value).some((metric) => metric !== undefined), "Agrega al menos una métrica.");

export async function getBiometricOverview() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const logs = await prisma.biometricLog.findMany({ where: { date: { gte: since } }, orderBy: { date: "desc" }, take: 60 });
  const latest = {
    weight: logs.find((log) => log.weight !== null)?.weight ?? null,
    sleep: logs.find((log) => log.sleep !== null)?.sleep ?? null,
    hrv: logs.find((log) => log.hrv !== null)?.hrv ?? null,
    steps: logs.find((log) => log.steps !== null)?.steps ?? null,
  };
  return { logs, latest, averages: biometricAverages(logs), readiness: biometricReadiness(latest) };
}

export async function logBiometrics(input: z.input<typeof biometricInput>) {
  const parsed = biometricInput.parse(input);
  const log = await prisma.biometricLog.create({ data: parsed });
  revalidatePath("/biometrics");
  revalidatePath("/gym");
  revalidatePath("/");
  return log;
}
