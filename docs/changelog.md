# ValleOS Changelog

## Phase 1 & 2: UI Scaffolding & Aesthetic Polish
*Status: COMPLETED*

- **App Structure**: Initialized Next.js App Router, global CSS (`globals.css`), and root layout with a persistent Sidebar and Topbar.
- **Aesthetic Definition**: Defined and rigidly applied a "Linear/Vercel" aesthetic (grayscale, minimal, `backdrop-blur`).
- **Dashboard Home (`/`)**: Created Bento-box grid layout with modules for "Deep Work", "Cash Flow", "Biometrics", and "Daily Notes".
- **Dynamic Topbar**: Implemented a "Dynamic Island" for music playback and a hover-based sliding panel for System Stats (CPU/RAM).
- **Shadow Identity**: Built the `ShadowOrb` component using `framer-motion` morphing SVGs to represent the system AI. Connected it to the `/shadow` route and Command Palette.
- **Command Palette**: Fully functional global search and command interface (`⌘+G`) using `cmdk`.
- **Navigation & Icons**: Migrated entire icon suite from Radix to Lucide React. Set up placeholder routes for Gym, Finances, Biometrics, and Obsidian.
- **Documentation**: Established `claude.md` and `/docs` rule sets. Banned large UI headers.

## Phase 3: Backend & Data Integration
*Status: PENDING*

- Initialize Prisma with SQLite.
- Create API endpoints for Finances and Gym modules.
- Connect Obsidian local vault.
- Wire `ShadowOrb` to an actual LLM pipeline.
