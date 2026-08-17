# Architecture Rules & Implementation

## Core Stack
- **Framework**: Next.js 14 App Router (`src/app`). All routes are server components by default unless interactive.
- **Styling**: Tailwind CSS. Avoid arbitrary values unless absolutely necessary for precision.
- **Icons**: Lucide React (`lucide-react`).
- **Animations**: Framer Motion (`framer-motion`) and GSAP (`gsap`, `@gsap/react`).
- **3D & WebGL**: Three.js wrapped via `@react-three/fiber` and `@react-three/drei`. Custom GLSL shaders used for material logic.
- **State**: Zustand (`useUIStore`) for cross-component UI state (e.g., Sidebar expansion).
- **Data Fetching**: SWR for client-side data fetching to ensure real-time responsiveness.

## Phase 3 Database Roadmap (Pending)
We will use **Prisma ORM** with **SQLite** for local persistence to ensure absolute privacy and speed.
- `schema.prisma` will define:
  - `Workout` / `Exercise` models.
  - `Expense` / `Income` models.
  - `BiometricLog` models.
- Next.js Route Handlers (`src/app/api/...`) will act as the controller layer.

## The "Shadow" AI Agent
Shadow is the core entity of ValleOS.
- Visually represented by the `ShadowOrb` component.
- The `CommandPalette` (`⌘+G`) is the primary textual interface for talking to Shadow from anywhere.
- Future integration requires an LLM endpoint (e.g., local Ollama or OpenAI API) to power the reasoning and NLP extraction capabilities.
