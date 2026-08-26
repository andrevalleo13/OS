"use client";

import { useUIStore } from "@/store/useUIStore";

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const isSidebarExpanded = useUIStore((state) => state.isSidebarExpanded);

  return (
    <div
      className={`os-main min-h-[100dvh] px-3 pb-24 pt-20 transition-[padding] duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] sm:px-4 md:pb-5 md:pr-5 md:pt-24 ${
        isSidebarExpanded ? "md:pl-[272px]" : "md:pl-[96px]"
      }`}
    >
      {children}
    </div>
  );
}
