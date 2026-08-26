# Protocolo Shadow: El Cerebro de ValleOS

Shadow es la inteligencia artificial general (AGI local) central del sistema. Su arquitectura está diseñada para convertir lenguaje natural (NLP) no estructurado en transacciones deterministas en la base de datos de ValleOS.

## El NLP Router (`src/app/actions/shadow.ts`)
A diferencia de los chatbots tradicionales que solo devuelven texto, el NLP Router de Shadow actúa como un "agente".
1. **El Motor**: Utiliza `claude-haiku-4-5-20251001` (Anthropic) por su velocidad ultra-rápida de inferencia, ideal para interacciones vocales fluidas.
2. **Context Injection**: Antes de cada solicitud, el Router construye dinámicamente un bloque `<system_context>` que contiene la hora actual, las métricas del día (macros, gym) y datos geolocalizados. Esto dota a Claude de conciencia del entorno (Context Awareness).
3. **Tool Calling (Function Calling)**: Se le provee a Claude un esquema estricto JSON de herramientas (`add_expense`, `log_food`). Si detecta la intención, Claude devuelve la estructura JSON, el servidor la atrapa, e importa dinámicamente las acciones de Prisma (`@/actions/finance.ts` o `@/app/actions/nutrition.ts`) para ejecutar el código real en base de datos y proveer feedback al usuario.

## Interfaz Inmersiva (HUD)
- **ShadowOrb**: Actualmente utiliza una animación SVG basada en barras. **Plan a futuro**: Desarrollar un motor de renderizado con WebGL y GLSL (Shaders) para crear un orbe fluido y tridimensional que emule la calidad visual de asistentes nivel AGI.
- **Split-Screen Chat**: El diseño inteligente detecta si hay logs y adapta fluidamente un layout centralizado a una pantalla dividida (Split-Screen) con scroll independiente. La caja de texto (`textarea`) es dinámicamente escalable con cálculos matemáticos exactos para el alineamiento.

## Personalidad y Prompting
Shadow es un "Alter-Ego". El prompt de sistema le prohíbe explícitamente hablar como un asistente robótico. A diferencia de las iteraciones anteriores, **ahora tiene permitido usar Markdown** para estructurar mejor la información cuando lee de la terminal o de Obsidian. Además, debe finalizar siempre sus respuestas con metadatos especiales (`<mood>` y `<widget>`) que el Frontend intercepta para cambiar el color del orbe o mostrar componentes React (como la agenda o stats) en tiempo real.

## Terminal y Node.js Integration
Shadow no está limitado al backend tradicional. Tiene una inyección directa a `child_process.execSync`, permitiéndole actuar como un intérprete nativo de macOS desde la misma ventana del navegador. Puede crear, mover, y organizar el sistema de archivos del host según los deseos del usuario.
