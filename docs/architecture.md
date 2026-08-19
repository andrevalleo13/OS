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

## La IA "Shadow" (El Cerebro)
Shadow es la entidad central y el motor de NLP de ValleOS.
- Representada visualmente por el componente `ShadowOrb`.
- **Ruta Dedicada (`/shadow`)**: Es el HUD principal (Heads Up Display). Utiliza un diseño de sala de control cinemático con registros de flujo cognitivo en tiempo real y paneles de telemetría, prescindiendo del grid clásico.
- **Activación por Voz (Wake Word)**: Utiliza `SpeechRecognition` nativo en el navegador para escuchar. Se activa al decir la palabra "Shadow".
- **Router Global NLP**: La lógica de servidor en `src/actions/shadow.ts` sirve como el enrutador inteligente. Se conecta a Claude 3 (Anthropic) y expone herramientas (`tool_use` o Function Calling) para que el LLM ejecute acciones directas en la base de datos Prisma basadas en lenguaje natural estructurado.
- Toda su comunicación interna y respuesta visual está programada en español como alter-ego digital del usuario.
