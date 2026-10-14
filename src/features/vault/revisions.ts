import "server-only";

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export function contentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Deja constancia de un cambio de Shadow en la bóveda para poder revertirlo
 * desde `/shadow/memory`. Una creación con `beforeContent: ""` se revierte
 * borrando la nota (ver `restoreObsidianRevision`).
 */
export async function recordObsidianRevision(input: {
  relativePath: string;
  beforeContent: string;
  afterContent: string;
  operation: "create" | "update";
}) {
  return prisma.obsidianRevision.create({
    data: {
      path: input.relativePath,
      operation: input.operation,
      beforeContent: input.beforeContent,
      afterContent: input.afterContent,
      beforeHash: contentHash(input.beforeContent),
      afterHash: contentHash(input.afterContent),
    },
  });
}
