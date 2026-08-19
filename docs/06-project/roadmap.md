# JARVIS ROADMAP (ValleOS AGI)

Este documento proyecta el camino arquitectónico para transformar la actual implementación NLP de ValleOS en un Sistema de Inteligencia Artificial General y Autónoma real (Project JARVIS).

## Visión Final
ValleOS debe dejar de ser un sistema puramente "reactivo" (donde espera a que el usuario presione un botón o le hable), para convertirse en un sistema **proactivo y autónomo**. La IA debe ser capaz de gestionar la vida del usuario, adelantarse a las fricciones diarias y tomar control de su ecosistema digital.

## Nivel 1: Conexión de Datos (Current State - Fase 5)
- [x] Conexión de NLP a Bases de Datos (Shadow + Prisma).
- [x] Interfaz de Telemetría (Shadow HUD).
- [x] Ingesta de texto a acciones (`tool_use`).

## Nivel 2: Integraciones Híbridas (Próximos Pasos)
- **Bóveda Obsidian**: Construcción de un daemon local en Next.js (FS Access) que permita a Shadow indexar, buscar (Semantic Search) y reescribir archivos Markdown directamente en el disco duro local de la computadora.
- **WhatsApp/Messaging Interception**: Un webhook en el backend que permita a Shadow leer mensajes entrantes, analizar la urgencia, y auto-responder a clientes o amigos simulando el estilo de escritura del usuario.
- **Gestión Autónoma de Proyectos (Linear/Jira)**: Shadow debe escanear el backlog de proyectos del usuario y automáticamente crear los tickets en el `AgendaWidget` del dashboard cada mañana.

## Nivel 3: Motores de Proactividad
- **Background Cron Jobs**: Server actions programados que permitan a Shadow despertar internamente sin trigger del usuario.
- Si Shadow nota en la base de datos que el usuario no ha registrado macros para el almuerzo y son las 4 PM, debe enviar una notificación push o activar los altavoces de la casa preguntando si olvidó comer.
- **Auto-Booking y Agentes Financieros**: Integración de Puppeteer o APIs bancarias (Plaid) en el backend. Si el usuario recibe un correo de un cargo injustificado, Shadow navega la web, levanta el ticket con el banco, y solo le notifica al usuario que "resolvió un problema de la tarjeta y recuperó $500".
