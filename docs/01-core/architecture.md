# ValleOS: Arquitectura Core

## Stack Tecnológico ("God Level")
ValleOS no es un simple dashboard; es un sistema operativo web (Web OS).
- **Framework Base**: Next.js 16 (App Router) y React 19. Los datos sensibles y las integraciones con macOS permanecen en el runtime Node.js del servidor local.
- **Client Components**: Restringidos únicamente a nodos hojas (`"use client"`) donde la interactividad pura (ej. Framer Motion, GSAP, WebGL) es indispensable.
- **Motor de Renderizado 3D**: `Three.js` + `@react-three/fiber` + `@react-three/drei`. Modelos `.glb` comprimidos cargados asíncronamente.
- **Estilos**: Tailwind CSS con un strictísimo enfoque monocromático (Stealth/Linear Aesthetic).

## Next.js Server Actions
ValleOS usa **Server Actions** para operaciones internas tipadas y **Route Handlers** únicamente como adaptadores HTTP para macOS, música, salud y calendario.
- La lógica vive en módulos feature-first bajo `src/features/`.
- Los límites validan entradas con Zod; las rutas locales verifican host y origen.
- Shadow no recibe shell libre: usa herramientas explícitas, rutas acotadas y confirmación para cambios de archivos.

## Estado Global
- **Zustand** (`src/store/useUIStore.ts`): Maneja la topología de la interfaz, incluyendo la sincronización de animaciones, la expansión de widgets, y el modo cognitivo del usuario (`focusMode`).
- **SWR (Stale-While-Revalidate)**: Utilizado para el caché inteligente del cliente en flujos de datos externos (ej. la música o sensores lentos).
- **ShadowVoiceProvider**: Mantiene una sola máquina de estados de voz para todo el árbol cliente. La barra superior, el HUD, el widget y la página de Shadow consumen este contexto sin abrir sesiones de micrófono independientes.

## Shadow Memory Intelligence
- **PostgreSQL/Prisma** conserva conversaciones, resúmenes, hechos, documentos, fragmentos, entidades, relaciones, revisiones y eventos de vida.
- **Context Router** decide qué dominios consultar; Obsidian no se inyecta por defecto en una charla general.
- **Índice híbrido** combina términos semánticos, conceptos extraídos y coincidencias lexicales sin depender de un vector store externo.
- **Life Graph** conecta personas, proyectos, lugares y conceptos usando evidencia trazable a su fuente.
- **Curación silenciosa** actualiza notas existentes y agrega conexiones; cada escritura conserva una revisión reversible.
- **Mantenimiento durable** corre desde el daemon: indexación incremental, resumen de conversaciones y revisión de memoria.

## Proactividad y autonomía
- **Pattern Engine** calcula hábitos sobre datos estructurados y conserva evidencia, confianza y tamaño de muestra.
- **Insight Engine** compara el presente contra patrones y compromisos; deduplica, expira y prioriza cada intervención.
- **Autonomy Policy** define modo, horario silencioso, límite diario y canales permitidos.
- **Automation Queue** separa la decisión de la ejecución con idempotencia, aprobación, intentos y un historial por ejecución.
- **Worker local** procesa macOS, Apple Mail y Apple Calendar; el proceso autenticado de WhatsApp consume sólo sus trabajos.
- **Safety boundary** impide reintentos automáticos de comunicaciones externas cuyo resultado pudiera ser ambiguo.
