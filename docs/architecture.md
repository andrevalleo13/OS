# Reglas de Arquitectura e Implementación

## Stack Principal
- **Framework**: Next.js 14 App Router (`src/app`). Todas las rutas son server components por defecto a menos que requieran interactividad.
- **Estilos**: Tailwind CSS. Evita usar valores arbitrarios a menos que sea absolutamente necesario para precisión.
- **Íconos**: Lucide React (`lucide-react`).
- **Animaciones**: Framer Motion (`framer-motion`) y GSAP (`gsap`, `@gsap/react`).
- **3D y WebGL**: Three.js encapsulado vía `@react-three/fiber` y `@react-three/drei`. Se usan shaders personalizados de GLSL para la lógica de los materiales.
- **Estado**: Zustand (`useUIStore`) para el estado de UI cruzado entre componentes (ej. expansión de la barra lateral).
- **Obtención de Datos**: SWR para la obtención de datos del lado del cliente, asegurando respuesta en tiempo real.

## Hoja de Ruta de Base de Datos
Usamos **Prisma ORM** con **PostgreSQL/Neon** para la persistencia.
- `schema.prisma` define:
  - Modelos de `Workout` / `Exercise`.
  - Modelos de `FoodLog` (Nutrición y Agua).
  - Modelos de `BiometricLog`.
  - Modelos de `Note` para el Second Brain.
  - Modelos de `Transaction` para el Cash Flow.
- Se usan Next.js Server Actions en la carpeta `src/actions` como la capa de controladores.

## La IA "Shadow"
Shadow es la entidad central de ValleOS.
- Representada visualmente por el componente `ShadowOrb` y `ShadowWidget`.
- **Activación por Voz (Wake Word)**: Utiliza `SpeechRecognition` nativo en el navegador para escuchar constantemente. Se activa al decir la palabra "Shadow".
- **Conciencia del Entorno**: Conectada a la API de Geolocalización y Open-Meteo para entender clima y hora del día.
- La paleta de comandos (`CommandPalette` con `⌘+G` o `⌘+K`) sirve como interfaz alternativa a la voz.
- Toda su comunicación, prompts internos de análisis y respuestas para el usuario deben generarse exclusivamente en español.
- Utiliza la API de Anthropic (Claude 3) para la extracción de NLP y capacidades de razonamiento.
