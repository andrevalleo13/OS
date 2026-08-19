# ValleOS: Arquitectura Core

## Stack Tecnológico ("God Level")
ValleOS no es un simple dashboard; es un sistema operativo web (Web OS).
- **Framework Base**: Next.js 14 (App Router). Absolutamente todas las rutas se manejan desde el servidor (Server Components) por defecto, garantizando velocidades de renderizado instantáneas y SEO perfecto.
- **Client Components**: Restringidos únicamente a nodos hojas (`"use client"`) donde la interactividad pura (ej. Framer Motion, GSAP, WebGL) es indispensable.
- **Motor de Renderizado 3D**: `Three.js` + `@react-three/fiber` + `@react-three/drei`. Modelos `.glb` comprimidos cargados asíncronamente.
- **Estilos**: Tailwind CSS con un strictísimo enfoque monocromático (Stealth/Linear Aesthetic).

## Next.js Server Actions
ValleOS prohíbe el uso de API Routes tradicionales (`/api/`) para la comunicación interna con la base de datos.
- Todo el fetching y mutación de datos se realiza a través de **Server Actions** (`src/actions/`).
- Las Server Actions exponen herramientas de mutación seguras de tipado estricto directamente a la IA (Shadow) y a los componentes cliente.

## Estado Global
- **Zustand** (`src/store/useUIStore.ts`): Maneja la topología de la interfaz, incluyendo la sincronización de animaciones, la expansión de widgets, y el modo cognitivo del usuario (`focusMode`).
- **SWR (Stale-While-Revalidate)**: Utilizado para el caché inteligente del cliente en flujos de datos externos (ej. la música o sensores lentos).
