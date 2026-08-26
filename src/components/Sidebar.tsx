"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Dumbbell,
  GraduationCap,
  Home,
  Search,
  Settings,
  Utensils,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";

const primaryItems = [
  { icon: Home, label: "Inicio", href: "/" },
  { icon: CalendarDays, label: "Calendario", href: "/calendar" },
  { icon: CircleDot, label: "Shadow", href: "/shadow" },
];

const lifeItems = [
  { icon: Activity, label: "Biometría", href: "/biometrics" },
  { icon: BookOpen, label: "Obsidian", href: "/obsidian" },
  { icon: Dumbbell, label: "Gimnasio", href: "/gym" },
  { icon: Utensils, label: "Nutrición", href: "/food" },
  { icon: GraduationCap, label: "Universidad", href: "/uni" },
  { icon: BarChart3, label: "Finanzas", href: "/finances" },
];

const mobileItems = [primaryItems[0], primaryItems[1], primaryItems[2], lifeItems[2], lifeItems[3]];

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const isExpanded = useUIStore((state) => state.isSidebarExpanded);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const openPalette = () => document.dispatchEvent(new CustomEvent("valleos:command-palette"));

  return (
    <>
      <aside
        className={`group/sidebar os-surface fixed bottom-4 left-4 top-4 z-50 hidden overflow-visible rounded-[28px] transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] md:flex md:flex-col ${isExpanded ? "w-[240px]" : "w-[64px]"}`}
        aria-label="Navegación principal"
      >
        <button
          type="button"
          onClick={openPalette}
          className={`mx-2 mt-2 flex h-10 shrink-0 items-center rounded-xl border border-transparent text-white/40 transition hover:border-white/[0.06] hover:bg-white/[0.035] hover:text-white/80 active:scale-[0.98] ${isExpanded ? "px-3" : "justify-center"}`}
          aria-label="Abrir comandos"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className={`ml-3 whitespace-nowrap text-xs transition-opacity ${isExpanded ? "opacity-100" : "hidden opacity-0"}`}>Comandos</span>
          {isExpanded && <kbd className="ml-auto font-mono text-[9px] text-white/25">⌘K</kbd>}
        </button>

        <div className={`${isExpanded ? "mt-3" : "mt-0"} flex-1 overflow-y-auto px-2 pb-2`}>
          <NavGroup label="Sistema" items={primaryItems} pathname={pathname} expanded={isExpanded} />
          <NavGroup label="Vida" items={lifeItems} pathname={pathname} expanded={isExpanded} />
        </div>

        <div className="border-t border-white/[0.055] p-2">
          <NavLink item={{ icon: Settings, label: "Ajustes", href: "/settings" }} pathname={pathname} expanded={isExpanded} />
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          className="pointer-events-none absolute -right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#171717] text-white/35 opacity-0 shadow-xl transition-[opacity,color,border-color,transform] duration-200 hover:border-white/20 hover:text-white active:scale-95 group-hover/sidebar:pointer-events-auto group-hover/sidebar:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
          aria-label={isExpanded ? "Contraer navegación" : "Expandir navegación"}
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-500 ${isExpanded ? "rotate-180" : ""}`} />
        </button>
      </aside>

      <nav className="os-surface fixed inset-x-3 bottom-3 z-50 grid h-16 grid-cols-5 rounded-[22px] px-1 md:hidden" aria-label="Navegación móvil">
        {mobileItems.map((item) => {
          const active = isCurrent(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] text-[9px] transition active:scale-[0.96] ${active ? "text-[color:var(--accent)]" : "text-white/35"}`} aria-current={active ? "page" : undefined}>
              <Icon className="h-[18px] w-[18px]" />
              <span className="truncate">{item.label}</span>
              {active && <span className="absolute bottom-1 h-0.5 w-3 rounded-full bg-[color:var(--accent)]" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function NavGroup({ label, items, pathname, expanded }: { label: string; items: typeof primaryItems; pathname: string; expanded: boolean }) {
  return (
    <div className={expanded ? "mb-4" : "mb-0"}>
      {expanded && <p className="h-6 px-3 font-mono text-[8px] uppercase tracking-[0.2em] text-white/20">{label}</p>}
      <div className={expanded ? "space-y-0.5" : "space-y-0"}>{items.map((item) => <NavLink key={item.href} item={item} pathname={pathname} expanded={expanded} />)}</div>
    </div>
  );
}

function NavLink({ item, pathname, expanded }: { item: (typeof primaryItems)[number]; pathname: string; expanded: boolean }) {
  const active = isCurrent(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link href={item.href} title={expanded ? undefined : item.label} aria-current={active ? "page" : undefined} className={`relative flex h-10 items-center rounded-xl transition active:scale-[0.98] ${expanded ? "px-3" : "justify-center"} ${active ? "bg-white/[0.065] text-white" : "text-white/35 hover:bg-white/[0.035] hover:text-white/75"}`}>
      {active && <span className="absolute left-0 h-4 w-0.5 rounded-full bg-[color:var(--accent)]" />}
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[color:var(--accent)]" : ""}`} />
      <span className={`ml-3 whitespace-nowrap text-[12px] transition-opacity ${expanded ? "opacity-100" : "hidden opacity-0"}`}>{item.label}</span>
    </Link>
  );
}
