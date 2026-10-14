import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { rejectNonLocalRequest } from "@/lib/local-request";
import { absoluteVaultPath } from "@/features/vault/fs";
import { errorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp", pdf: "application/pdf",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", mp4: "video/mp4",
  webm: "video/webm", mov: "video/quicktime",
};

/** Sirve adjuntos de la bóveda (imágenes, PDFs, audio) para los embeds `![[...]]`. */
export async function GET(request: Request) {
  const rejection = rejectNonLocalRequest(request);
  if (rejection) return rejection;
  const filePath = new URL(request.url).searchParams.get("path") ?? "";
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return NextResponse.json({ error: "Tipo de archivo no permitido." }, { status: 415 });
  try {
    const absolute = await absoluteVaultPath(filePath);
    const data = await fs.readFile(absolute);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=60",
        // Un SVG de la bóveda nunca debe ejecutar scripts.
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 404 });
  }
}
