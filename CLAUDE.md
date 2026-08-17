# ValleOS Dashboard - AI Guidelines

Welcome to ValleOS. When assisting with this project, you must adhere strictly to these global directives. Failure to do so breaks the core product vision.

## 1. Aesthetic Directives (The "Stealth Vercel" Look)
- **Zero Clutter**: NEVER use large `<h1>` or `<h2>` page headers on canvas components. Context is provided solely by the `Topbar` breadcrumbs and visual layout.
- **Iconography**: ALWAYS use `lucide-react`. Never use Radix, Heroicons, or Material.
- **Color Palette**: Stick to a strict grayscale theme (`#0a0a0a`, `#111`, `#1a1a1a`, `#222`). Highlights are pure white (`#ffffff`) or extremely desaturated tones. The only exceptions are specific branding accents (like the `#ff5500` ValleOS accent or specific gradient blobs).
- **Typography**: Extremely tight and small. `text-[10px]` to `text-sm` is preferred. Monospace (`font-mono`) should be used for data, percentages, and logs.
- **Glassmorphism**: Use `backdrop-blur-3xl` and translucent backgrounds (`bg-black/90` or `bg-[#0a0a0a]/95`) combined with ultra-thin borders (`border-white/10` or `border-[#222]`) for overlays, dropdowns, and sidebars.

## 2. Animation Guidelines
- **Framer Motion**: Almost all layout mounts/unmounts should use `framer-motion` (`AnimatePresence`, `motion.div`). Keep transitions fast and snappy (`duration: 0.15` to `0.3`, `easeOut` or springs).
- **GSAP**: Reserved for complex coordinated timelines (like the Sidebar expand/collapse text staggers). Do not mix GSAP and Framer Motion on the exact same properties.

## 3. WebGL & 3D Integration
- **Libraries**: Use `@react-three/fiber` and `@react-three/drei` for all 3D canvas rendering.
- **Performance**: Ensure heavy `.glb` assets are loaded with `<Suspense>` boundaries to prevent Next.js crashes.
- **Interactivity**: For complex meshes where individual muscle raycasting isn't possible natively, use transparent procedural overlays ("AR Hitboxes") to restore pointer interactions.

## 4. Architecture Rules
- **Framework**: Next.js 14 App Router.
- **State**: Zustand for global UI state (`useUIStore`). SWR for data fetching and real-time dashboard updates.
- **Database**: Prisma + SQLite (Phase 3).
- **Identity**: The system AI is explicitly named **"Shadow"**. It manifests as an ever-present, fluid visual element (`ShadowOrb`) and a central command interface.

*For detailed breakdowns, see the `/docs/` folder.*
