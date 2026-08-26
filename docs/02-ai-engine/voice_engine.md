# Motor de voz de Shadow

Shadow ofrece una conversación manos libres mientras ValleOS permanece abierto. El motor vive en `ShadowVoiceProvider`, se monta una sola vez desde el layout raíz y mantiene una única instancia de reconocimiento para toda la aplicación.

## Flujo de interacción

```text
ARMED → “Shadow” → LISTENING → PROCESSING → SPEAKING → ARMED
```

- `armed`: el reconocimiento está esperando exclusivamente la palabra de activación.
- `listening`: Shadow capturó la activación y espera una instrucción durante ocho segundos.
- `processing`: la instrucción se envió al mismo motor y conversación que utiliza el chat escrito.
- `speaking`: la respuesta se reproduce con `speechSynthesis`; el reconocimiento se detiene para no escucharse a sí mismo.
- `blocked`, `unsupported` y `muted`: representan permiso pendiente, navegador incompatible o voz pausada por el usuario.

La orden puede darse junta —“Shadow, organiza mi tarde”— o en dos frases: primero “Shadow” y después la instrucción. Se aceptan algunas variantes fonéticas comunes para tolerar errores del reconocimiento en español.

## Alcance global y conversaciones

- En `/shadow`, la voz continúa la conversación que está abierta y la interfaz recibe los mensajes en tiempo real.
- Fuera de `/shadow`, los turnos se guardan en la conversación dedicada `dashboard:voice`, visible como “Voz con Shadow”.
- Cada instrucción posterior a la activación y cada respuesta pasan por `askShadow`, por lo que quedan persistidas en PostgreSQL y participan en los resúmenes durables y la memoria normal de Shadow.
- El widget, el orbe flotante, la barra superior y la página dedicada consumen el mismo estado global; no crean micrófonos concurrentes.

## Activación y permisos

La preferencia se guarda en `valleos.shadow.voice-enabled.v1` y por defecto queda activa. El navegador puede exigir una interacción manual la primera vez para conceder acceso al micrófono. Una vez otorgado el permiso, Shadow vuelve a armar el reconocimiento automáticamente después de responder, al regresar a la pestaña o cuando el navegador interrumpe una sesión recuperable.

La barra superior siempre muestra si la voz está activa, escuchando, pensando, hablando o pausada. El usuario puede detenerla desde ahí o desde el HUD de voz.

## Privacidad y límites

- ValleOS no almacena audio ambiente ni archivos de voz.
- Solo se persiste el texto reconocido después de escuchar la palabra “Shadow”.
- `SpeechRecognition` puede ser implementado por el proveedor del navegador y enviar audio a sus servicios; no se debe describir como procesamiento garantizado 100% local.
- El modo manos libres funciona mientras la pestaña o la aplicación web de ValleOS está abierta. Escuchar con el navegador completamente cerrado requerirá un helper nativo de macOS y permisos propios del sistema.
- La síntesis utiliza las voces disponibles en el dispositivo, priorizando `es-MX` y después cualquier voz en español.

## Recuperación

- Un error `not-allowed` muestra una acción explícita para solicitar el permiso de nuevo.
- La ausencia de voz o un final inesperado rearma el reconocimiento sin enviar contenido vacío.
- Existe un guard contra órdenes duplicadas mientras Shadow procesa o habla.
- Un timeout de escucha evita dejar una captura de comando abierta indefinidamente.
