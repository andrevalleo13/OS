import { NextResponse } from "next/server";
import { rejectNonLocalRequest } from "@/lib/local-request";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const rejection = rejectNonLocalRequest(request);
  if (rejection) return rejection;
  return NextResponse.json({ status: "ok", service: "valleos-dashboard" });
}
