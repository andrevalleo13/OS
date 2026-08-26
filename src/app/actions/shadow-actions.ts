"use server";

import { after } from "next/server";
import { z } from "zod";
import { approveAutonomyJob, executeReadyAutomationJobs } from "@/features/shadow/autonomy";
import { approveFileAction } from "@/features/shadow/file-actions";
import { errorMessage, NotFoundError } from "@/lib/errors";

export async function approveShadowAction(id: string) {
  try {
    const actionId = z.string().uuid().parse(id);
    try {
      const job = await approveAutonomyJob(actionId);
      after(() => executeReadyAutomationJobs());
      return { success: true as const, message: `${job.summary} fue aprobada y quedó en cola segura.` };
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      const message = await approveFileAction(actionId);
      return { success: true as const, message };
    }
  } catch (error) {
    return { success: false as const, message: errorMessage(error) };
  }
}
