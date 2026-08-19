# Dashboard de ValleOS - Directrices de la IA

Bienvenido a ValleOS. Al asistir en este proyecto, debes adherirte estrictamente a estas directrices globales. No hacerlo rompe la visión central del producto.

## 1. Directrices Estéticas (El Look "Stealth Vercel")
- **Cero Desorden**: NUNCA uses encabezados grandes `<h1>` o `<h2>` en componentes tipo canvas. El contexto lo proporciona únicamente el componente `Topbar` (breadcrumbs) y la disposición visual.
- **Iconografía**: SIEMPRE usa `lucide-react`. Nunca uses Radix, Heroicons o Material.
- **Paleta de Colores**: Mantén un tema estricto en escala de grises (`#0a0a0a`, `#111`, `#1a1a1a`, `#222`). Los resaltes son blanco puro (`#ffffff`) o tonos extremadamente desaturados. Las únicas excepciones son acentos específicos de la marca (como el acento `#ff5500` de ValleOS o los gradientes dinámicos del orbe).
- **Tipografía**: Extremadamente ajustada y pequeña. Se prefiere `text-[10px]` a `text-sm`. Se debe usar monoespaciada (`font-mono`) para datos, porcentajes y registros.
- **Glassmorfismo**: Usa `backdrop-blur-3xl` y fondos translúcidos (`bg-black/90` o `bg-[#0a0a0a]/95`) combinados con bordes ultra delgados (`border-white/10` o `border-[#222]`) para overlays, menús desplegables y barras laterales.

## 2. Pautas de Animación
- **Framer Motion**: Casi todos los montajes/desmontajes de diseño deben usar `framer-motion` (`AnimatePresence`, `motion.div`). Mantén las transiciones rápidas y ágiles (`duration: 0.15` a `0.3`, `easeOut` o springs).
- **GSAP**: Reservado para líneas de tiempo coordinadas complejas (como la cascada de texto al expandir/colapsar la barra lateral). No mezcles GSAP y Framer Motion en las mismas propiedades exactas.

## 3. Integración 3D y WebGL
- **Librerías**: Usa `@react-three/fiber` y `@react-three/drei` para todo el renderizado 3D en canvas.
- **Rendimiento**: Asegúrate de que los archivos pesados `.glb` se carguen con límites de `<Suspense>` para evitar que Next.js colapse.
- **Interactividad**: Para mallas complejas donde el raycasting de músculos individuales no es posible de forma nativa, usa overlays procedimentales transparentes ("Hitboxes AR") para restaurar las interacciones del puntero.

## 4. Reglas de Arquitectura
- **Framework**: Next.js 14 App Router.
- **Estado**: Zustand para estado global de UI (`useUIStore`). SWR para obtención de datos y actualizaciones en tiempo real del dashboard.
- **Base de Datos**: Prisma + SQLite / Postgres (Fase 3).
- **Identidad**: La IA del sistema se llama explícitamente **"Shadow"**. Se manifiesta como un elemento visual fluido y siempre presente (`ShadowOrb`) y como una interfaz de comandos centralizada. Todo su texto y respuestas deben ser en español.

*Para desgloses detallados, consulta la carpeta `/docs/`.*
