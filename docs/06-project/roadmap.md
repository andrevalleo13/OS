# JARVIS ROADMAP (ValleOS AGI)

Este documento proyecta el camino arquitectónico para transformar la actual implementación NLP de ValleOS en un Sistema de Inteligencia Artificial General y Autónoma real (Project JARVIS).

## Visión Final
ValleOS debe dejar de ser un sistema puramente "reactivo" (donde espera a que el usuario presione un botón o le hable), para convertirse en un sistema **proactivo y autónomo**. La IA debe ser capaz de gestionar la vida del usuario, adelantarse a las fricciones diarias y tomar control de su ecosistema digital.

## Nivel 1: Conexión de Datos y HUD (Completado - Fase 5)
- [x] Conexión de NLP a Bases de Datos (Shadow + Prisma).
- [x] Interfaz de Telemetría (Shadow HUD).
- [x] Ingesta de texto a acciones (`tool_use` para finanzas y **nutrición**).
- [x] Diseño estético "Pro" (Chat de pantalla dividida, auto-expand textarea calculado matemáticamente).

## Nivel 1.5: Shadow Core (Completado - Primera Entrega JARVIS)
- [x] Conversaciones persistentes por canal en PostgreSQL; el dashboard y WhatsApp ya no dependen de memoria temporal.
- [x] `Context Router` para consultar únicamente nutrición, fitness, finanzas, universidad, calendario u Obsidian cuando la conversación lo sugiere.
- [x] Contexto estructurado de ValleOS con respuestas mínimas y seguras para el modelo.
- [x] Memoria operativa, eventos de vida y auditoría de acciones preparados en el esquema central.
- [x] Curador silencioso de Obsidian: resuelve entidades existentes, actualiza la nota correcta, evita duplicados y agrega `[[wikilinks]]`.
- [x] Inbox de memoria para coincidencias ambiguas, sin crear entidades duplicadas a ciegas.
- [x] Panel de actividad y restauración segura de cambios de memoria.
- [x] Resúmenes automáticos de conversaciones largas.

## Nivel 1.75: Voz manos libres (Completado - Web Runtime)
- [x] Proveedor global único de voz; no existen reconocedores duplicados por widget o página.
- [x] Activación por “Shadow”, orden en la misma frase o en el siguiente turno y timeout de escucha.
- [x] Ciclo visual completo `armed → listening → processing → speaking → armed` con el orbe clásico restaurado.
- [x] Respuesta hablada en español y supresión del micrófono durante la síntesis para evitar feedback.
- [x] Registro de instrucciones y respuestas dentro de conversaciones persistentes, con resúmenes y memoria silenciosa.
- [x] Estado visible, pausa global, recuperación tras suspensión de pestaña y manejo de permisos/compatibilidad.
- [ ] Helper nativo de macOS para palabra de activación aun con el navegador cerrado, audio local y selección explícita de dispositivo.

## Nivel 2: Memoria Inteligente (Completado - Fase 2)
- [x] Índice híbrido de Obsidian por documento y fragmento, con conceptos, expansión semántica y búsqueda lexical de respaldo.
- [x] `Life Graph` persistente para personas, proyectos, lugares, conceptos y sus relaciones.
- [x] `Event Bus` durable para unir conversaciones, acciones, memoria e indexación.
- [x] Consolidación periódica no destructiva: Shadow propone duplicados, conflictos y hechos obsoletos para revisión.
- [x] Historial reversible de escrituras en Obsidian, con verificación de hash para no pisar cambios posteriores.
- [x] Panel `/shadow/memory` para inspeccionar, corregir, desactivar, restaurar y conectar la memoria.
- [x] El daemon mantiene el índice, los resúmenes y la consolidación sin interrumpir el chat.

## Nivel 2.5: Integraciones Híbridas y WebGL (Próximos Pasos)
- **Evolución opcional del ShadowOrb**: Conservar la identidad del orbe clásico y evaluar una versión WebGL/GLSL únicamente si mantiene su cara, legibilidad y rendimiento.
- **Gestión Autónoma de Proyectos (Linear/Jira)**: Shadow debe escanear el backlog de proyectos del usuario y automáticamente crear los tickets en el `AgendaWidget` del dashboard cada mañana.

## Nivel 3: Inteligencia Proactiva (Completado - Fase 3)
- [x] Detectores deterministas de patrones de comida, entrenamiento, gasto y sueño con evidencia, tamaño de muestra y confianza.
- [x] Motor de insights que compara el estado actual con hábitos, entregas y líneas base reales.
- [x] Ventanas de silencio, límite diario, urgencia, expiración y deduplicación para no convertir proactividad en spam.
- [x] Ejecución periódica desde el daemon y botón de análisis manual en `/shadow/autonomy`.
- [x] Insights y patrones inspeccionables y descartables; Shadow aprende cuando una inferencia no representa a Andre.

## Nivel 4: Autonomía Segura (Completado - Fase 4)
- [x] Cola durable e idempotente con estados, intentos, backoff, recuperación de workers interrumpidos y auditoría.
- [x] Política por niveles de riesgo: notificaciones internas automáticas; acciones externas con aprobación exacta.
- [x] Apple Mail para borradores y envío aprobado, Apple Calendar para eventos aprobados y WhatsApp mediante el daemon.
- [x] Herramientas de Shadow para preparar correos, WhatsApp y calendario sin fingir que ya se ejecutaron.
- [x] Panel `/shadow/autonomy` para modos observar/asistir/autónomo, horarios, permisos, insights y aprobaciones.
- [x] En acciones externas ambiguas no hay reintento automático, evitando mensajes o correos duplicados.

## Nivel 5: Próximos motores
- **Gestión Autónoma de Proyectos (Linear/Jira)**: convertir objetivos y reuniones en backlog priorizado.
- **Agentes financieros conectados**: conciliación de cargos y preparación de reclamaciones con aprobación reforzada.
- **Canales adicionales**: Gmail/Google Workspace y mensajería con identidad de contactos verificada.
