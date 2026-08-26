"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { restoreObsidianRevision } from "@/app/actions/obsidian";
import { summarizeStaleConversations } from "@/features/shadow/conversation-summary";
import { indexKnowledgeVault } from "@/features/shadow/knowledge-index";
import { consolidateShadowMemories } from "@/features/shadow/memory-consolidation";
import {
  resolveMemoryReview,
  setShadowMemoryActive,
  updateShadowMemory,
} from "@/features/shadow/memory-dashboard";

const idSchema = z.string().uuid();

export async function setMemoryActiveAction(id: string, active: boolean) {
  await setShadowMemoryActive(idSchema.parse(id), z.boolean().parse(active));
  revalidatePath("/shadow/memory");
}

export async function updateMemoryAction(id: string, formData: FormData) {
  const content = z.string().trim().min(1).max(2_000).parse(formData.get("content"));
  await updateShadowMemory(idSchema.parse(id), content);
  revalidatePath("/shadow/memory");
}

export async function resolveMemoryReviewAction(id: string, decision: "apply" | "dismiss") {
  await resolveMemoryReview(idSchema.parse(id), z.enum(["apply", "dismiss"]).parse(decision));
  revalidatePath("/shadow/memory");
}

export async function restoreObsidianRevisionAction(id: string) {
  await restoreObsidianRevision(idSchema.parse(id));
  revalidatePath("/shadow/memory");
}

export async function runKnowledgeIndexAction() {
  await indexKnowledgeVault({ maxDocuments: 20 });
  revalidatePath("/shadow/memory");
}

export async function runMemoryMaintenanceAction() {
  await Promise.all([
    consolidateShadowMemories(),
    summarizeStaleConversations(),
  ]);
  revalidatePath("/shadow/memory");
}
