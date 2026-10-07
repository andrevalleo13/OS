const INTRO_KEY = "valleos.dashboard.intro.v1";
/** Ventana en la que todas las piezas de una misma carga deciden lo mismo. */
const SAME_LOAD_MS = 2_500;

/**
 * ¿Toca la entrada del dashboard? Solo la primera vez por sesión: repetirla en
 * cada visita la convierte en espera. Es idempotente durante la misma carga
 * (StrictMode y varios componentes la consultan).
 */
export function shouldPlayDashboardIntro(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reducedMotion === "true") return false;
  try {
    const now = Date.now();
    const playedAt = Number(window.sessionStorage.getItem(INTRO_KEY));
    if (!playedAt) {
      window.sessionStorage.setItem(INTRO_KEY, String(now));
      return true;
    }
    return now - playedAt < SAME_LOAD_MS;
  } catch {
    return false;
  }
}
