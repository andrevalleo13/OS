import { NextResponse } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostname(value: string | null): string {
  if (!value) return "";
  try {
    return new URL(value.includes("://") ? value : `http://${value}`).hostname;
  } catch {
    return "";
  }
}

export function rejectNonLocalRequest(request: Request): NextResponse | null {
  const host = hostname(request.headers.get("host"));
  const originHeader = request.headers.get("origin");
  const origin = originHeader ? hostname(originHeader) : host;

  if (!LOCAL_HOSTS.has(host) || !LOCAL_HOSTS.has(origin)) {
    return NextResponse.json(
      { success: false, error: { code: "LOCAL_ONLY", message: "ValleOS solo acepta conexiones locales." } },
      { status: 403 },
    );
  }

  return null;
}
