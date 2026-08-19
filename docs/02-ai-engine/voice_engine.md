# El Motor de Voz y HUD Cinemático

La principal interfaz para comunicarse con Shadow no es el teclado, es la voz pura y una retroalimentación visual cinemática.

## El HUD (Heads-Up Display)
Ruta: `/shadow`
- **Diseño**: Elimina el concepto de un "dashboard web" (sin cuadrículas Bento) para simular una sala de servidores de alta gama.
- **Flujo Cognitivo**: En la esquina inferior, un componente auto-scrolleable renderiza en tiempo real los logs del servidor (ej. `[NLP] Parsing intent matrix...`). Esto le da al usuario retroalimentación determinista sobre qué está haciendo la IA detrás de cámaras.
- **Aura Ambiental**: El fondo de la pantalla incluye un `blur` de luz dinámico usando Framer Motion que reacciona a los estados de Shadow:
  - `listening`: Naranja neón pulsante, escala aumentada (110%).
  - `thinking`: Blanco tenue (retrocedido a 90%).
  - `speaking`: Animación neutra.

## `useWakeWord` y Speech API
ValleOS utiliza el hook personalizado `useWakeWord` que encapsula la API nativa de `SpeechRecognition` de WebKit.
- El micrófono escucha de fondo pasivamente, procesando el audio en el cliente sin latencia de red ni consumo de tokens de API.
- Solo captura e inicializa el pipeline de Claude cuando escucha el disparador ("Shadow").
