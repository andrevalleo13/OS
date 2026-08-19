"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useUIStore } from "@/store/useUIStore";

gsap.registerPlugin(useGSAP);

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const isSidebarExpanded = useUIStore((state) => state.isSidebarExpanded);
  const mainRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Animate the main content padding so it smoothly gets pushed by the sidebar
    gsap.to(mainRef.current, {
      paddingLeft: isSidebarExpanded ? 240 + 32 : 64 + 32, // Width of sidebar + 16px left gap + 16px gap to content
      duration: 0.45,
      ease: "power3.inOut",
    });
  }, [isSidebarExpanded]);

  return (
    <div ref={mainRef} className="pt-24 pr-4 pb-4 min-h-screen">
      {children}
    </div>
  );
}
