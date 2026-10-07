"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import type { ShadowStatus } from "@/components/shadow/types";
import {
  EXPRESSIONS,
  STATE_EXPRESSION,
  statusFromMood,
  type EyeShape,
  type Expression,
  type ExpressionName,
} from "@/components/shadow/face/expressions";
import { FACE_MOTION, FACE_PALETTE } from "@/components/shadow/face/palette";

/* Geometría en unidades del viewBox (0–100) del cuerpo. */
const CENTER = 50;
const EYE_OFFSET = 15;
const EYE_Y = 46;
const EYE_W = 10;
const EYE_H = 22;
/** Cuánto pueden viajar las pupilas desde el centro. */
const GAZE_RANGE = 5;
/** Distancia del cursor, en px, a la que la mirada llega al máximo. */
const GAZE_FALLOFF = 260;
const BLINK_MIN_MS = 2800;
const BLINK_EXTRA_MS = 3200;
const DOUBLE_BLINK_CHANCE = 0.22;
/** Sin cursor por este tiempo, Shadow mira alrededor por su cuenta. */
const IDLE_GLANCE_MS = 4500;
/** Pensar es mirar arriba y a los lados, como buscando. */
const SACCADES = [
  { x: -1, y: -1 },
  { x: 0.9, y: -0.8 },
  { x: -0.5, y: -0.3 },
  { x: 0.7, y: -1 },
] as const;
const SPIRAL = "M0 0C-0.6 -4 5 -5 6 -0.6C7 4.5 1 8 -4 6C-9 4.5 -9.5 -2 -6 -6";
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const TAU = Math.PI * 2;
const EYE_SPRING = { type: "spring", stiffness: 380, damping: 26 } as const;
const INSTANT = { duration: 0 } as const;

export type ShadowOrbProps = {
  status?: ShadowStatus;
  /** `<mood>` del modelo. Solo cambia la cara cuando `status` es `idle`. */
  mood?: string | null;
  /** Fuerza un gesto concreto, ignorando el estado. */
  expression?: ExpressionName | Expression;
  /** Oculta el halo exterior (para avatares y cabeceras). */
  hideBackground?: boolean;
  /** Congela al personaje: sin respiración, parpadeo ni mirada. */
  paused?: boolean;
  /** Sigue el cursor con la mirada. */
  gaze?: boolean;
  className?: string;
};

/**
 * Shadow como personaje: un vidrio oscuro con mármol de color dentro y dos
 * ojos que expresan lo que está haciendo. El estado se comunica con el gesto
 * y el color, no con iconos pegados encima.
 */
function ShadowOrb({
  status = "idle",
  mood,
  expression,
  hideBackground = false,
  paused = false,
  gaze = true,
  className = "",
}: ShadowOrbProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const animated = !paused && !reduced && onScreen;

  const state: ShadowStatus = status === "idle" && mood ? statusFromMood(mood) : status;
  const palette = FACE_PALETTE[state];
  const spec = FACE_MOTION[state];
  const expressionName: ExpressionName | null = typeof expression === "object" ? null : expression ?? STATE_EXPRESSION[state];
  const face: Expression = typeof expression === "object" ? expression : EXPRESSIONS[expressionName ?? "neutral"];
  const drawHappy = expressionName === "happy" && !reduced;
  const drawDizzy = expressionName === "dizzy" && !reduced;
  const eyesClosed = expressionName === "sleepy" || drawHappy || drawDizzy;
  const looksAway = state === "thinking" || drawDizzy;

  const leftLid = useAnimationControls();
  const rightLid = useAnimationControls();
  const bodyControls = useAnimationControls();
  const gazeX = useSpring(0, { stiffness: 210, damping: 24 });
  const gazeY = useSpring(0, { stiffness: 210, damping: 24 });
  const eyeBounce = useMotionValue(0);
  const eyesY = useTransform<number, number>([gazeY, eyeBounce], ([y, bounce]) => y + bounce);
  const spinA = useMotionValue(0);
  const spinB = useMotionValue(140);
  const bodyScale = useMotionValue(1);

  const specRef = useRef(spec);
  const stateRef = useRef(state);
  const mountedRef = useRef(false);
  const lastPointerRef = useRef(0);

  useEffect(() => {
    specRef.current = spec;
    stateRef.current = state;
  }, [spec, state]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fuera de pantalla no se anima nada: el dashboard puede tener varias caras.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Un solo bucle por cara: mármol, respiración y "voz" mientras habla.
  useEffect(() => {
    if (!animated) return;
    let frame = 0;
    let last = performance.now();
    let elapsed = 0;
    let speed = specRef.current.spin;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const current = specRef.current;
      // La velocidad se acerca a la del nuevo estado en lugar de saltar.
      speed += (current.spin - speed) * Math.min(1, dt * 2.5);
      spinA.set((spinA.get() + speed * dt) % 360);
      spinB.set((spinB.get() - speed * 0.63 * dt) % 360);

      let scale = 1 + Math.sin(elapsed * TAU * current.breatheHz) * current.breathe;
      if (stateRef.current === "speaking") {
        // Amplitud sintética: dos senos desfasados se sienten como sílabas.
        const energy = (0.5 + 0.5 * Math.sin(elapsed * 11.3)) * (0.55 + 0.45 * Math.sin(elapsed * 3.1 + 1));
        scale += energy * 0.045;
        eyeBounce.set(-energy * 1.8);
      } else {
        eyeBounce.set(eyeBounce.get() * 0.85);
      }
      bodyScale.set(scale);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animated, bodyScale, eyeBounce, spinA, spinB]);

  // Cerrar rápido y abrir suave: un parpadeo parejo se ve mecánico.
  const blink = useCallback(async (double = false) => {
    const close = { duration: 0.07, ease: EASE_IN };
    const open = { duration: 0.16, ease: EASE_OUT };
    for (let round = 0; round < (double ? 2 : 1); round += 1) {
      if (!mountedRef.current) return;
      await Promise.all([leftLid.start({ scaleY: 0.08 }, close), rightLid.start({ scaleY: 0.08 }, close)]);
      if (!mountedRef.current) return;
      await Promise.all([leftLid.start({ scaleY: 1 }, open), rightLid.start({ scaleY: 1 }, open)]);
    }
  }, [leftLid, rightLid]);

  useEffect(() => {
    if (!animated || eyesClosed) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        void blink(Math.random() < DOUBLE_BLINK_CHANCE);
        schedule();
      }, BLINK_MIN_MS + Math.random() * BLINK_EXTRA_MS);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [animated, blink, eyesClosed]);

  // La mirada sigue al cursor; si no hay cursor, mira alrededor de vez en cuando.
  useEffect(() => {
    if (!animated || !gaze || looksAway) return;
    const follow = (event: PointerEvent) => {
      const node = rootRef.current;
      if (!node) return;
      lastPointerRef.current = performance.now();
      const rect = node.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const reach = Math.min(1, Math.hypot(dx, dy) / GAZE_FALLOFF) * GAZE_RANGE;
      const angle = Math.atan2(dy, dx);
      gazeX.set(Math.cos(angle) * reach);
      gazeY.set(Math.sin(angle) * reach * 0.8);
    };
    const glance = window.setInterval(() => {
      if (performance.now() - lastPointerRef.current < IDLE_GLANCE_MS) return;
      if (Math.random() < 0.45) {
        gazeX.set(0);
        gazeY.set(0);
      } else {
        gazeX.set((Math.random() * 2 - 1) * GAZE_RANGE);
        gazeY.set((Math.random() * 1.4 - 0.7) * GAZE_RANGE);
      }
    }, 2200);
    window.addEventListener("pointermove", follow, { passive: true });
    return () => {
      window.removeEventListener("pointermove", follow);
      window.clearInterval(glance);
    };
  }, [animated, gaze, gazeX, gazeY, looksAway]);

  // Al pensar, mira hacia arriba y a los lados.
  useEffect(() => {
    if (!animated || state !== "thinking") return;
    let index = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        const target = SACCADES[index % SACCADES.length];
        index += 1;
        gazeX.set(target.x * GAZE_RANGE);
        gazeY.set(target.y * GAZE_RANGE);
        schedule();
      }, 650 + Math.random() * 650);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [animated, gazeX, gazeY, state]);

  // Gestos de cuerpo al cambiar de estado.
  useEffect(() => {
    if (drawDizzy) {
      gazeX.set(0);
      gazeY.set(0);
    }
    if (!animated) return;
    if (state === "done") {
      void bodyControls.start(
        { scaleX: [1, 1.08, 0.94, 1.04, 0.99, 1], scaleY: [1, 0.9, 1.08, 0.95, 1.02, 1], y: ["0%", "3%", "-9%", "0%", "-3%", "0%"] },
        { duration: 0.85, ease: EASE_OUT, times: [0, 0.12, 0.4, 0.62, 0.82, 1] },
      );
    } else if (state === "error") {
      void bodyControls.start(
        { rotate: [0, -11, 9, -7, 5, -3, 0], x: ["0%", "-5%", "4%", "-3%", "2%", "-1%", "0%"] },
        { duration: 1.05, ease: [0.45, 0, 0.55, 1] },
      );
    } else if (state === "warning") {
      void bodyControls.start({ x: ["0%", "-2.5%", "2.5%", "-1.5%", "0%"] }, { duration: 0.45, ease: "easeInOut" });
    } else if (state === "listening") {
      void bodyControls.start({ scale: [1, 1.07, 1], y: ["0%", "-3%", "0%"] }, { duration: 0.5, ease: EASE_OUT });
    }
  }, [animated, bodyControls, drawDizzy, gazeX, gazeY, state]);

  const vars = {
    "--face-core": palette.core,
    "--face-mid": palette.mid,
    "--face-light": palette.light,
    "--face-glow": palette.glow,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`shadow-face relative aspect-square h-full w-full [container-type:size] ${className}`}
      style={vars}
    >
      {!hideBackground ? (
        <motion.div
          className="pointer-events-none absolute inset-[-14%] rounded-full"
          initial={false}
          animate={{ opacity: spec.glow, scale: state === "speaking" || state === "listening" ? 1.06 : 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--face-glow) 42%, transparent) 0%, transparent 66%)", filter: "blur(4cqw)" }}
        />
      ) : null}

      <motion.div animate={bodyControls} className="absolute inset-[7%]">
        <motion.div className="absolute inset-0" style={{ scale: bodyScale }}>
          <div
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{ background: "radial-gradient(circle at 50% 118%, var(--face-mid) 0%, var(--face-core) 58%, #030303 100%)", isolation: "isolate" }}
          >
            <motion.div
              className="absolute inset-[-30%]"
              style={{
                rotate: spinA,
                background: "radial-gradient(circle at 32% 30%, var(--face-light) 0%, transparent 30%), radial-gradient(circle at 72% 70%, var(--face-mid) 0%, transparent 44%)",
                filter: "blur(6cqw)",
                opacity: 0.5,
                mixBlendMode: "screen",
              }}
            />
            <motion.div
              className="absolute inset-[-30%]"
              style={{
                rotate: spinB,
                background: "conic-gradient(from 90deg, transparent 0deg, var(--face-mid) 70deg, transparent 150deg, var(--face-light) 230deg, transparent 300deg)",
                filter: "blur(9cqw)",
                opacity: 0.3,
                mixBlendMode: "screen",
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{ boxShadow: "inset 0 -9cqw 14cqw rgba(0,0,0,0.62), inset 0 0 0 0.7cqw rgba(255,255,255,0.07), inset 0 2cqw 4cqw color-mix(in srgb, var(--face-light) 16%, transparent)" }}
            />
            <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(ellipse 42% 26% at 36% 18%, rgba(255,255,255,0.3), transparent 70%)" }} />
          </div>
        </motion.div>

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full overflow-visible"
          style={{ filter: "drop-shadow(0 0 2.2cqw color-mix(in srgb, var(--face-glow) 75%, transparent))" }}
        >
          <motion.g style={{ x: gazeX, y: eyesY }}>
            <AnimatePresence initial={false} mode="popLayout">
              {drawHappy ? (
                <motion.g key="happy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {([-1, 1] as const).map((side) => (
                    <HappyEye key={side} side={side} />
                  ))}
                </motion.g>
              ) : drawDizzy ? (
                <motion.g key="dizzy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {([-1, 1] as const).map((side) => (
                    <DizzyEye key={side} side={side} spinning={animated} />
                  ))}
                </motion.g>
              ) : (
                <motion.g key="eyes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Eye side={-1} shape={face.left} lid={leftLid} instant={reduced} />
                  <Eye side={1} shape={face.right} lid={rightLid} instant={reduced} />
                </motion.g>
              )}
            </AnimatePresence>
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}

function Eye({ side, shape, lid, instant }: { side: -1 | 1; shape: EyeShape; lid: ReturnType<typeof useAnimationControls>; instant: boolean }) {
  const width = EYE_W * shape.w;
  const height = Math.max(EYE_H * shape.h, 0.8);
  const cx = CENTER + side * EYE_OFFSET;
  const cy = EYE_Y + (shape.dy ?? 0);
  return (
    <motion.g animate={lid} initial={{ scaleY: 1 }} style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
      <motion.rect
        initial={false}
        animate={{
          attrX: cx - width / 2,
          attrY: cy - height / 2,
          width,
          height,
          rx: Math.min(width, height) / 2,
          rotate: shape.rotate ?? 0,
        }}
        transition={instant ? INSTANT : EYE_SPRING}
        style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
        fill="#f7f7f7"
      />
    </motion.g>
  );
}

function HappyEye({ side }: { side: -1 | 1 }) {
  const cx = CENTER + side * EYE_OFFSET;
  return (
    <motion.path
      d={`M ${cx - 6} ${EYE_Y + 3} Q ${cx} ${EYE_Y - 6} ${cx + 6} ${EYE_Y + 3}`}
      fill="none"
      stroke="#f7f7f7"
      strokeWidth={4.2}
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    />
  );
}

function DizzyEye({ side, spinning }: { side: -1 | 1; spinning: boolean }) {
  return (
    <motion.path
      d={SPIRAL}
      fill="none"
      stroke="#f7f7f7"
      strokeWidth={2.4}
      strokeLinecap="round"
      animate={spinning ? { rotate: 360 * side } : { rotate: 0 }}
      transition={spinning ? { duration: 2.4, ease: "linear", repeat: Infinity } : INSTANT}
      style={{ x: CENTER + side * EYE_OFFSET, y: EYE_Y, scale: 1.35, transformBox: "fill-box", transformOrigin: "50% 50%" }}
    />
  );
}

export default memo(ShadowOrb);
