"use server";

import { z } from "zod";
import { assertLocalAction } from "@/lib/local-action";
import { getVaultIndex } from "@/features/vault/index";
import { dataviewSourceFromIndex, runDataviewQuery, type DataviewResult } from "@/features/vault/dataview";

const inputSchema = z.object({
  source: z.string().max(20_000),
  fromPath: z.string().max(1_000),
});

/** Ejecuta un bloque ```dataview``` (subconjunto de DQL) sobre el índice de la bóveda. */
export async function runVaultQuery(source: string, fromPath: string): Promise<DataviewResult> {
  await assertLocalAction();
  const input = inputSchema.parse({ source, fromPath });
  const index = await getVaultIndex();
  return runDataviewQuery(input.source, dataviewSourceFromIndex(index), input.fromPath);
}
