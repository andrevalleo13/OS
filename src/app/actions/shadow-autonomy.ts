"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  approveAutonomyJob,
  autonomyPolicyInputSchema,
  cancelAutonomyJob,
  executeReadyAutomationJobs,
  updateAutonomyPolicy,
} from "@/features/shadow/autonomy";
import { dismissShadowInsight, dismissShadowPattern } from "@/features/shadow/autonomy-dashboard";
import { runProactiveCycle } from "@/features/shadow/proactivity";

const idSchema = z.string().uuid();

export async function updateAutonomyPolicyAction(formData: FormData) {
  const input = autonomyPolicyInputSchema.parse({
    mode: formData.get("mode"),
    quietStart: formData.get("quietStart"),
    quietEnd: formData.get("quietEnd"),
    dailyDeliveryLimit: Number(formData.get("dailyDeliveryLimit")),
    allowMacNotifications: formData.get("allowMacNotifications") === "on",
    allowWhatsAppSelf: formData.get("allowWhatsAppSelf") === "on",
    allowEmailDrafts: formData.get("allowEmailDrafts") === "on",
    allowExternalSend: formData.get("allowExternalSend") === "on",
  });
  await updateAutonomyPolicy(input);
  revalidatePath("/shadow/autonomy");
}

export async function approveAutonomyJobAction(id: string) {
  await approveAutonomyJob(idSchema.parse(id));
  after(() => executeReadyAutomationJobs());
  revalidatePath("/shadow/autonomy");
}

export async function cancelAutonomyJobAction(id: string) {
  await cancelAutonomyJob(idSchema.parse(id));
  revalidatePath("/shadow/autonomy");
}

export async function dismissShadowInsightAction(id: string) {
  await dismissShadowInsight(idSchema.parse(id));
  revalidatePath("/shadow/autonomy");
}

export async function dismissShadowPatternAction(id: string) {
  await dismissShadowPattern(idSchema.parse(id));
  revalidatePath("/shadow/autonomy");
}

export async function runProactiveCycleAction() {
  await runProactiveCycle();
  after(() => executeReadyAutomationJobs());
  revalidatePath("/shadow/autonomy");
}

export async function runAutomationWorkerAction() {
  await executeReadyAutomationJobs();
  revalidatePath("/shadow/autonomy");
}
