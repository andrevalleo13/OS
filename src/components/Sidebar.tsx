"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ScanFace, Box, BarChart2, Settings, Search, ChevronRight, Wand2, Zap } from "lucide-react";
import ShadowOrb from "./ShadowOrb";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useUIStore } from "@/store/useUIStore";

gsap.registerPlugin(useGSAP);

export default function Sidebar() {
  const isExpanded = useUIStore((state) => state.isSidebarExpanded);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const buttonRef = useRef<HTMLDivElement>(null);

  const items = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Wand2, label: "Shadow", href: "/shadow" },
    { icon: ScanFace, label: "Biometrics", href: "/biometrics" },
    { icon: Box, label: "Obsidian", href: "/obsidian" },
    { icon: Zap, label: "Gym", href: "/gym" },
    { icon: BarChart2, label: "Finances", href: "/finances" },
  ];

  useGSAP(() => {
    // 1. Sidebar Width Animation (Super smooth spring-like feel using Power4)
    gsap.to(sidebarRef.current, {
      width: isExpanded ? 240 : 64,
      duration: 0.7,
      ease: "power4.inOut",
    });

    // 2. Chevron Rotation
    gsap.to(buttonRef.current, {
      rotate: isExpanded ? 180 : 0,
      duration: 0.5,
      ease: "back.out(1.5)",
    });

    // 3. Text Stagger Animation
    if (isExpanded) {
      // Show text
      gsap.to(textRefs.current, {
        opacity: 1,
        x: 0,
        display: "block",
        duration: 0.4,
        delay: 0.2, // wait for width to expand slightly
        stagger: 0.03,
        ease: "power2.out",
      });
    } else {
      // Hide text immediately
      gsap.to(textRefs.current, {
        opacity: 0,
        x: -10,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(textRefs.current, { display: "none" });
        }
      });
    }
  }, [isExpanded]);

  return (
    <nav 
      ref={sidebarRef}
      className="fixed left-4 top-4 bottom-4 w-[64px] bg-[#0a0a0a]/90 backdrop-blur-2xl border border-[#1a1a1a] shadow-2xl shadow-black/50 rounded-[32px] flex flex-col py-6 z-50 group"
    >
      
      {/* Expand/Collapse Toggle (Centered vertically to avoid overlapping menu items) */}
      <button 
        onClick={toggleSidebar}
        className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 bg-[#1a1a1a] border border-[#222] rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-50 shadow-lg"
      >
        <div ref={buttonRef}>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </button>

      <div className="px-3 mb-6">
        <button 
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', metaKey: true }))}
          className={`w-full h-8 rounded-full flex items-center ${isExpanded ? 'px-3 bg-transparent hover:bg-[#1a1a1a]' : 'justify-center bg-transparent hover:bg-[#1a1a1a]'} text-gray-500 hover:text-gray-300 transition-colors border border-transparent`}
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <div 
            ref={(el) => { if (el) textRefs.current[0] = el; }} 
            className="ml-3 flex-1 hidden opacity-0"
          >
            <div className="flex items-center w-full">
              <span className="text-xs font-normal text-gray-500">Search</span>
              <div className="ml-auto flex items-center gap-1 opacity-50">
                <kbd className="text-[9px] bg-[#1a1a1a] border border-[#222] text-gray-500 px-1 py-0.5 rounded-[4px] font-mono">⌘</kbd>
                <kbd className="text-[9px] bg-[#1a1a1a] border border-[#222] text-gray-500 px-1 py-0.5 rounded-[4px] font-mono">G</kbd>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex flex-col gap-2 flex-1 px-3">
        {items.map((item, i) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={i}
              href={item.href}
              className={`w-full h-10 rounded-full flex items-center ${isExpanded ? 'px-3' : 'justify-center'} transition-all duration-200 relative group/item
                ${isActive ? 'bg-[#1a1a1a] text-white' : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-200'}
              `}
              title={!isExpanded ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 min-w-[20px] shrink-0" />
              <span 
                ref={(el) => { if (el) textRefs.current[i + 1] = el; }}
                className="ml-3 text-sm font-medium whitespace-nowrap hidden opacity-0"
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Footer Settings & Shadow */}
      <div className="px-3 mt-auto flex flex-col gap-4">
        
        {/* Settings */}
        <button className={`w-full h-10 rounded-full flex items-center ${isExpanded ? 'px-3' : 'justify-center'} text-gray-500 hover:bg-[#1a1a1a] hover:text-white transition-colors`}>
          <Settings className="w-4 h-4 min-w-[16px] shrink-0" />
          <span 
            ref={(el) => { if (el) textRefs.current[items.length + 1] = el; }}
            className="ml-3 text-sm font-medium whitespace-nowrap hidden opacity-0"
          >
            Settings
          </span>
        </button>

      </div>

    </nav>
  );
}
