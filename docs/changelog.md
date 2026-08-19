# ValleOS - Registro de Cambios

## Fase 1 y 2: Andamiaje de UI y Pulido Estético
*Estado: COMPLETADO*

- **Estructura de la App**: Inicialización de Next.js App Router, CSS global (`globals.css`) y diseño base con barra lateral (Sidebar) y barra superior (Topbar) persistentes.
- **Definición Estética**: Definición y aplicación rígida de una estética "Linear/Vercel" (escala de grises, minimalismo, `backdrop-blur`).
- **Inicio del Dashboard (`/`)**: Creación de un diseño de cuadrícula tipo Bento-box con módulos para "Deep Work", "Flujo de Efectivo", "Biometría" y "Notas Diarias".
- **Topbar Dinámica**: Implementación de una "Isla Dinámica" para la reproducción de música y un panel deslizante basado en hover para estadísticas del sistema (CPU/RAM).
- **Identidad de Shadow**: Construcción del componente `ShadowOrb` usando SVGs de transformación con `framer-motion` para representar la IA del sistema. Conectado a la ruta `/shadow` y a la Paleta de Comandos.
- **Paleta de Comandos**: Interfaz funcional de búsqueda global y comandos (`⌘+G`) usando `cmdk`.
- **Navegación e Íconos**: Migración de todo el paquete de íconos de Radix a Lucide React. Configuración de rutas para Gimnasio, Finanzas, Biometría, Nutrición y Obsidian.
- **Documentación**: Establecimiento de los conjuntos de reglas en `CLAUDE.md` y `/docs`. Prohibición de encabezados de interfaz de usuario masivos. Todo el sistema está ahora en Español.

## Fase 2.5: Módulo de Gimnasio WebGL e Interactividad
*Estado: COMPLETADO*

- **Base 3D**: Integración de `@react-three/fiber` y `drei`. Configuración de una vista de canvas 3D para el Gimnasio.
- **Integración GLB**: Conversión e importación de un `anatomy.glb` externo de alta resolución.
- **Zooms Cinemáticos (GSAP)**: Creación de un `CameraController` fluido que vincula animaciones GSAP con `OrbitControls` y la posición de la cámara para zooms cinematográficos en músculos específicos.
- **Materiales Stealth**: Diseño de iluminación de estudio monocromática con luces de contorno y un material premium mate/obsidiana.

## Fase 2.6: Módulo de Nutrición e IA
*Estado: COMPLETADO*

- **Esquema de Base de Datos**: Actualización de Prisma para incluir el modelo `FoodLog` con soporte para calorías, macros y seguimiento de agua (litros).
- **Controlador de IA**: Creación de Server Actions (`nutrition.ts`) conectadas al SDK de Anthropic (Claude 3) para extraer automáticamente macros desde lenguaje natural en español (ej. "Me comí 3 huevos").
- **UI Minimalista**: Diseño de un dashboard estilo terminal con anillos circulares interactivos en formato SVG para el progreso de calorías, proteínas, carbohidratos, grasas y agua.

## Fase 3: UI Responsiva, Base de Datos y Voice Wake Word
*Estado: COMPLETADO*

- **Responsive Bento Grid**: Creación de un sistema de UI avanzado con `WidgetCard` y `WidgetContext`. Los widgets reaccionan y cambian de tamaño fluidamente usando `framer-motion` layout animations.
- **Backdrop Overlay**: Implementación de un fondo interactivo para restaurar el grid haciendo clic fuera del widget activo.
- **Conexión Prisma DB**: Incorporación del modelo `Note` y migración de datos falsos a llamadas reales usando **Server Actions** (`actions/finance.ts`, `actions/notes.ts`) conectados a PostgreSQL (NeonDB).
- **Wake Word API**: Desarrollo del hook `useWakeWord` con la API de `SpeechRecognition` nativa del navegador para activar a Shadow diciendo "Shadow".
- **Context Awareness**: El `ShadowWidget` ahora obtiene la geolocalización del dispositivo y consulta la API de Open-Meteo para proveer un saludo contextual (clima, hora del día).

## Fase 4: Integración de Datos Backend
*Estado: PENDIENTE*

- Expandir la base de datos de PostgreSQL/Neon con endpoints de Finanzas.
- Conectar la bóveda local de Obsidian.
- Conectar `ShadowOrb` a un pipeline de LLM conversacional.
