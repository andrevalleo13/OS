import "server-only";

import { headers } from "next/headers";
import { ForbiddenError } from "./errors";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Para server actions: igual que `rejectNonLocalRequest` en las rutas API, la
 * bóveda y el sistema solo se tocan desde esta Mac.
 */
export async function assertLocalAction() {
  const host = (await headers()).get("host") ?? "";
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  if (!LOCAL_HOSTS.has(hostname)) throw new ForbiddenError("La bóveda solo está disponible desde tu Mac.");
}
