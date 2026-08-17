# Design Rules (Stealth / Linear Aesthetic)

ValleOS Dashboard is designed to feel like a high-end, secretive, ultra-minimalist terminal for a hyper-productive user.

## Core Principles
1. **Content is the Interface**: The data should speak for itself. Do not wrap data in bulky containers or giant headers.
2. **Monochrome Dominance**: 95% of the UI should be grayscale. Use color ONLY for explicit semantic meaning (e.g., `#ff5500` for ValleOS branding, green for positive cash flow, subtle gradients for biometrics).
3. **Typography Scale**:
   - `text-[9px]`/`text-[10px]`: Secondary data, labels, idle states.
   - `text-[11px]`/`text-xs`: Primary labels, list items.
   - `text-sm`: Component headers, normal text.
   - `text-2xl`/`text-3xl`: ONLY for massive data points (e.g., Total Net Worth, Heart Rate), NOT for page titles.
4. **Spacing & Borders**:
   - Tightly pack related data.
   - Borders should never be thicker than `1px` or `2px`.
   - Border colors must be subtle (`border-white/10`, `border-[#222]`, `border-[#333]`).

## Layout Conventions
- **Page Titles**: DO NOT USE THEM. If the user clicks "Gym" on the sidebar, they know they are on the Gym page. A big `<h1>Gym</h1>` is redundant and breaks the aesthetic. Let the breadcrumbs in the Topbar do the work.
- **Glassmorphism**: Use `backdrop-blur` heavily on overlapping elements like dropdowns, sidebars, and command palettes to create depth without relying on harsh shadows.
- **Micro-interactions**: Everything interactive must have a hover state (usually `text-white` or `bg-[#1a1a1a]`) and a click state (`active:scale-95`).

## Iconography
- Must use `lucide-react`.
- Default stroke width is 2px, but downscale for tiny icons if necessary. 
- Icon sizes should rarely exceed `w-5 h-5` unless they are decorative.
