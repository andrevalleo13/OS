import path from "node:path";
import { ForbiddenError } from "@/lib/errors";

export function resolveWithinRoot(root: string, input: string): string {
  const normalized = input.startsWith("~/") ? input.slice(2) : input;
  const candidate = path.resolve(root, normalized);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ForbiddenError("La ruta debe permanecer dentro de la carpeta permitida.");
  }
  return candidate;
}
