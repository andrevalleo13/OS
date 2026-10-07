# Shadow como personaje

Shadow es el protagonista de ValleOS. Se manifiesta como una carita (`ShadowOrb`): un vidrio oscuro con mármol de color dentro y dos ojos que expresan lo que está haciendo. El estado se comunica con **gesto y color**, nunca con iconos pegados encima.

## Estados

| Estado | Color | Gesto |
| --- | --- | --- |
| `idle` | Grafito | Ojos neutrales, parpadeo, mira al cursor o alrededor |
| `listening` | Hielo (cian) | Ojos grandes, pequeño salto de atención. También mientras escribes |
| `thinking` | Violeta | Un ojo entrecerrado (duda), mira arriba y a los lados |
| `speaking` | Naranja ValleOS | Ojos y cuerpo laten como sílabas |
| `done` | Verde | Ojos felices `^ ^` y un salto con squash & stretch |
| `warning` | Ámbar | Ojos preocupados y un temblor breve |
| `error` | Rojo | Ojos en espiral y un mareo |

`done`, `warning` y `error` son estados de cierre: se muestran un instante después de una respuesta (según el `<mood>` del modelo, vía `statusFromMood`) y vuelven a `idle`. Los temporizadores nunca pisan un `thinking` posterior.

## Archivos

- `src/components/ShadowOrb.tsx`: el personaje. Props: `status`, `mood`, `expression`, `hideBackground`, `paused`, `gaze`.
- `src/components/shadow/face/expressions.ts`: los ojos son cápsulas descritas por alto, ancho, inclinación y desplazamiento. Agregar un gesto es agregar una entrada a `EXPRESSIONS`.
- `src/components/shadow/face/palette.ts`: **única fuente de color del personaje** y única excepción en `visual-policy.test.ts`. Ningún otro archivo puede introducir color.
- `src/app/globals.css`: registra `--face-*` con `@property` para que el navegador interpole los colores entre estados.

## Reglas

- En avatares de mensajes usa `hideBackground paused` y pasa el `mood` del mensaje: la cara queda fija con el gesto del resultado.
- En cabeceras densas usa `gaze={false}`: una docena de caras siguiendo el cursor es ruido.
- El personaje se detiene fuera de pantalla (IntersectionObserver) y respeta `prefers-reduced-motion` y la preferencia de la app.
- Sin boca: los ojos solos son más legibles y expresivos.

## Primitivas de conversación (`src/components/shadow/ai/`)

- `ShadowLoader`: puntos, barra o rejilla con un ciclo compartido; contador opcional. Nunca finge progreso.
- `ShadowSuggestions`: chips o tarjetas que aparecen desde el centro (las opciones pesan lo mismo).
- `ShadowConversation`: sigue el fondo solo si ya estás ahí; si subes a releer aparece "Ir a lo último".
- `ShadowResponse`: Markdown con revelado GSAP por bloques, solo para respuestas recién llegadas.
- `ShadowSources` / `ShadowCitation`: lo que Shadow consultó (contexto, memoria, notas, web, acciones). El mantenimiento silencioso de memoria nunca aparece.

## Dashboard

- `ShadowWidget` saluda según la hora, muestra la cara grande y "Lo importante ahora": máximo tres puntos de `buildBriefing` (`src/components/dashboard/briefing.ts`), deterministas y basados solo en datos reales.
- La entrada (cara, saludo palabra por palabra y tarjetas en cascada) ocurre **una vez por sesión** (`dashboard/intro.ts`). Repetirla en cada visita la convierte en espera.
- `WidgetCard` tiene un brillo que sigue al puntero mediante variables CSS, sin renders por movimiento.
