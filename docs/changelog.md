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

## Phase 2.5: WebGL Gym Module & Interactivity
*Status: COMPLETED*

- **3D Foundation**: Integrated `@react-three/fiber` and `drei`. Set up a 3D Gym canvas view.
- **GLB Integration**: Converted and imported an external high-res `body.glb` (ecorche model) via `gltf-pipeline`.
- **Dynamic Scaling**: Built a `BoundingBox` algorithm to auto-scale and perfectly center any imported `.glb` mesh to 1.8 units tall, resolving Next.js hot-reload cache bugs.
- **GSAP Camera Control**: Created a smooth `CameraController` linking GSAP animations with `OrbitControls.target` and `camera.position` for cinematic zooms on specific muscles.
- **AR Hitbox System**: Engineered a hybrid rendering layer where the original textures of the solid `.glb` are preserved, but a transparent procedural model overlay (`uHitboxMode`) acts as a raycastable hit-box system for specific muscle interaction and glowing highlights.

## Phase 3: Backend & Data Integration
*Status: PENDING*

- Initialize Prisma with SQLite.
- Create API endpoints for Finances and Gym modules.
- Connect Obsidian local vault.
- Wire `ShadowOrb` to an actual LLM pipeline.
