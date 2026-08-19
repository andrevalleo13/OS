# Protocolo Shadow: El Cerebro de ValleOS

Shadow es la inteligencia artificial general (AGI local) central del sistema. Su arquitectura está diseñada para convertir lenguaje natural (NLP) no estructurado en transacciones deterministas en la base de datos de ValleOS.

## El NLP Router (`src/actions/shadow.ts`)
A diferencia de los chatbots tradicionales que solo devuelven texto, el NLP Router de Shadow actúa como un "agente".
1. **El Motor**: Utiliza `Claude 3.5 Haiku` (Anthropic) por su velocidad ultra-rápida de inferencia, ideal para interacciones vocales fluidas.
2. **Context Injection**: Antes de cada solicitud, el Router construye dinámicamente un bloque `<system_context>` que contiene la hora actual, las métricas del día (macros, gym) y datos geolocalizados. Esto dota a Claude de conciencia del entorno (Context Awareness).
3. **Tool Calling (Function Calling)**: Se le provee a Claude un esquema estricto JSON de herramientas, como `add_expense`. Si detecta la intención, Claude devuelve la estructura JSON, el servidor la atrapa, e importa dinámicamente las acciones de Prisma (`@/actions/finance.ts`) para ejecutar el código real.

## Personalidad y Prompting
Shadow es un "Alter-Ego". El prompt de sistema le prohíbe explícitamente hablar como un asistente robótico o formatear texto con markdown (ya que su texto se leerá en vivo en un HUD). Debe hablar de tú, usar un tono casual y casi "mágico" donde nunca revela al usuario los bloques de contexto que inyecta el sistema por detrás.
