"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ShadowStatus } from "@/components/shadow/types";

const PATHS = {
  idle: {
    left: ["M 28 35 Q 28 42.5 28 50", "M 28 37 Q 28 42.5 28 48", "M 28 35 Q 28 42.5 28 50"],
    center: ["M 38 65 Q 50 78 62 65", "M 40 66 Q 50 75 60 66", "M 38 65 Q 50 78 62 65"],
    right: ["M 72 35 Q 72 42.5 72 50", "M 72 37 Q 72 42.5 72 48", "M 72 35 Q 72 42.5 72 50"],
  },
  thinking: {
    left: ["M 22 50 Q 28 50 34 50", "M 24 50 Q 28 50 32 50", "M 22 50 Q 28 50 34 50"],
    center: ["M 44 50 Q 50 50 56 50", "M 46 50 Q 50 50 54 50", "M 44 50 Q 50 50 56 50"],
    right: ["M 66 50 Q 72 50 78 50", "M 68 50 Q 72 50 76 50", "M 66 50 Q 72 50 78 50"],
  },
  speaking: {
    left: ["M 28 35 Q 28 50 28 65", "M 28 20 Q 28 50 28 80", "M 28 35 Q 28 50 28 65"],
    center: ["M 50 15 Q 50 50 50 85", "M 50 35 Q 50 50 50 65", "M 50 15 Q 50 50 50 85"],
    right: ["M 72 40 Q 72 50 72 60", "M 72 25 Q 72 50 72 75", "M 72 40 Q 72 50 72 60"],
  },
};

function ShadowOrb({
  status = "idle",
  hideBackground = false,
  paused = false,
}: {
  status?: ShadowStatus;
  hideBackground?: boolean;
  paused?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = !paused && !prefersReducedMotion;
  const visualStatus = status === "listening" ? "idle" : status;
  const paths = PATHS[visualStatus];
  const isSpeaking = status === "speaking";
  const isThinking = status === "thinking";
  const isListening = status === "listening";
  const isActive = status !== "idle";
  const pathDuration = isSpeaking ? 0.45 : isThinking ? 1.5 : isListening ? 1.25 : 4;

  return (
    <div className="relative flex h-full w-full items-center justify-center" aria-hidden="true">
      <motion.div
        animate={motionEnabled ? {
          opacity: isActive ? [0.3, 0.6, 0.3] : [0.1, 0.2, 0.1],
          scale: isSpeaking ? [1, 1.1, 1] : isListening ? [1, 1.06, 1] : [1, 1.03, 1],
        } : { opacity: isActive ? 0.45 : 0.15, scale: 1 }}
        transition={{
          opacity: { duration: isSpeaking ? 1 : isListening ? 1.5 : 4, repeat: Infinity, ease: "easeInOut" },
          scale: { duration: isSpeaking ? 0.8 : isListening ? 1.5 : 4, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute h-[115%] w-[115%] rounded-[30%]"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)", filter: "blur(30px)" }}
      />

      <motion.div
        animate={motionEnabled ? {
          scale: isSpeaking ? [1, 1.08, 0.97, 1] : isThinking ? [1, 0.96, 1.02, 1] : isListening ? [1, 1.035, 1] : [1, 1.01, 1],
          borderRadius: hideBackground ? "50%" : isSpeaking ? ["28%", "34%", "26%", "28%"] : isThinking ? ["28%", "32%", "28%"] : ["28%", "30%", "28%"],
        } : { scale: 1, borderRadius: hideBackground ? "50%" : "28%" }}
        transition={{
          scale: { duration: isSpeaking ? 0.8 : isThinking ? 1.2 : isListening ? 1.5 : 6, repeat: Infinity, ease: "easeInOut" },
          borderRadius: { duration: isSpeaking ? 0.6 : 5, repeat: Infinity, ease: "easeInOut" },
        }}
        className={`relative flex aspect-square h-full w-full items-center justify-center ${hideBackground ? "" : "overflow-hidden"}`}
        style={{
          boxShadow: hideBackground ? "none" : isActive
            ? "0 0 40px rgba(255,255,255,0.06), inset 0 0 30px rgba(0,0,0,0.8)"
            : "0 0 20px rgba(0,0,0,0.4), inset 0 0 30px rgba(0,0,0,0.8)",
        }}
      >
        {!hideBackground ? (
          <>
            <motion.div
              animate={motionEnabled ? { rotate: [0, 360] } : { rotate: 0 }}
              transition={{ duration: isSpeaking ? 3 : isThinking ? 2 : isListening ? 7 : 20, repeat: Infinity, ease: "linear" }}
              className="absolute h-[250%] w-[250%]"
              style={{
                background: "conic-gradient(from 0deg, #080808 0%, #1a1a1a 15%, #2a2a2a 25%, #111111 35%, #333333 45%, #0d0d0d 55%, #222222 65%, #151515 75%, #2d2d2d 85%, #080808 100%)",
                filter: "blur(12px)",
              }}
            />
            <motion.div
              animate={motionEnabled ? { rotate: [360, 0] } : { rotate: 0 }}
              transition={{ duration: isSpeaking ? 4 : isThinking ? 3 : isListening ? 9 : 25, repeat: Infinity, ease: "linear" }}
              className="absolute h-[200%] w-[200%] opacity-60"
              style={{
                background: "conic-gradient(from 180deg, transparent 0%, #3a3a3a 20%, transparent 40%, #4a4a4a 60%, transparent 80%, #3a3a3a 100%)",
                filter: "blur(16px)",
                mixBlendMode: "screen",
              }}
            />
            <div className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,0.9), inset 0 2px 0 rgba(255,255,255,0.03)" }} />
            <div className="pointer-events-none absolute left-[15%] right-[15%] top-0 z-10 h-[35%] rounded-b-full bg-gradient-to-b from-white/80 to-transparent opacity-[0.04]" />
          </>
        ) : null}

        <motion.svg
          viewBox="0 0 100 100"
          className="relative z-20 h-[60%] w-[60%]"
          style={{ filter: isActive ? "drop-shadow(0 0 16px rgba(255,255,255,0.7))" : "drop-shadow(0 0 10px rgba(255,255,255,0.4))" }}
        >
          {(["left", "center", "right"] as const).map((part, index) => (
            <motion.path
              key={part}
              fill="none"
              stroke="#fff"
              strokeWidth="14"
              strokeLinecap="round"
              animate={motionEnabled ? {
                d: paths[part],
                y: isThinking ? [0, -6, 0] : isListening ? [0, index === 1 ? 2 : -2, 0] : 0,
              } : { d: paths[part][0], y: 0 }}
              transition={{
                d: { duration: pathDuration + index * 0.03, repeat: Infinity, ease: "easeInOut" },
                y: { duration: isListening ? 1.5 : 1.2, repeat: Infinity, ease: "easeInOut", delay: index * 0.15 },
              }}
            />
          ))}
        </motion.svg>
      </motion.div>
    </div>
  );
}

export default memo(ShadowOrb);
