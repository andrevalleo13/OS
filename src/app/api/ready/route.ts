import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serverConfig } from "@/lib/config";
import { rejectNonLocalRequest } from "@/lib/local-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const rejection = rejectNonLocalRequest(request);
  if (rejection) return rejection;

  const checks = { database: false, vault: false, anthropicConfigured: Boolean(serverConfig.anthropic.apiKey) };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }
  try {
    if (serverConfig.paths.vault) await fs.access(serverConfig.paths.vault);
    checks.vault = Boolean(serverConfig.paths.vault);
  } catch {
    checks.vault = false;
  }
  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json({ status: ready ? "ready" : "degraded", checks }, { status: ready ? 200 : 503 });
}
