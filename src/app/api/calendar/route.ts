import { NextResponse } from "next/server";
import { z } from "zod";
import { addCalendarEvent, deleteCalendarEvent, listCalendarEvents } from "@/features/calendar/calendar.service";
import { errorMessage } from "@/lib/errors";
import { rejectNonLocalRequest } from "@/lib/local-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function apiError(error: unknown) {
  const status = error instanceof z.ZodError ? 422 : 500;
  const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Entrada inválida." : errorMessage(error);
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: Request) {
  const rejection = rejectNonLocalRequest(request);
  if (rejection) return rejection;
  try {
    return NextResponse.json({ success: true, events: await listCalendarEvents() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const rejection = rejectNonLocalRequest(request);
  if (rejection) return rejection;
  try {
    await addCalendarEvent(await request.json());
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const rejection = rejectNonLocalRequest(request);
  if (rejection) return rejection;
  try {
    await deleteCalendarEvent(await request.json());
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
