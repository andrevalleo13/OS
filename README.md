# ValleOS Dashboard 🌐

ValleOS Dashboard es la interfaz central del sistema operativo personal `ValleOS`, potenciado por **Shadow**, una Inteligencia Artificial Autónoma construida sobre la API de Anthropic (Claude 3.5 Haiku).

## Arquitectura y Funcionalidades Principales

Este proyecto no es solo una página web estática, sino una base de operaciones conectada a nivel de sistema.

### 1. Shadow (El Segundo Cerebro)
- **Agente Autónomo**: Shadow vive en `/shadow` y es capaz de ejecutar acciones proactivas sin interacción del usuario gracias a un *heartbeat* de fondo que analiza constantemente el estado del sistema.
- **Autonomía segura**: Shadow usa herramientas explícitas, rutas acotadas y una cola durable. Correos, WhatsApp, calendario y operaciones sensibles requieren aprobación visible y quedan auditados.
- **Memoria Continua y Base de Conocimiento**: El sistema se sincroniza en tiempo real con la bóveda de Obsidian (`valleos-vault`). Shadow lee y escribe silenciosamente en las notas para recordar preferencias, interacciones y el "lore" personal del usuario, actualizando sus propias directivas (`900 - Sistema/Directivas de Shadow.md`).
- **Patrones e insights**: `/shadow/autonomy` muestra qué hábitos detectó, por qué quiere intervenir y qué acciones están pendientes.

### 2. Nutrición y Salud (Módulo Integrado)
- UI rica y responsiva para el rastreo diario de Calorías y Macros.
- **Gym Visualizer**: Visualización en 3D (`@react-three/fiber`) del cuerpo humano para visualizar rutinas y recuperación muscular.
- Todos los cálculos de agua y calorías se exportan diariamente al diario en Obsidian.

## Cómo empezar

El dashboard está construido en **Next.js 16 (App Router)**, React 19, Prisma 7 y Tailwind CSS 4.

Para levantar el servidor de desarrollo local (el cual proveerá a Shadow de permisos de ejecución en tu máquina):

```bash
npm run dev
npm run daemon
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador para acceder a ValleOS.

El servidor se enlaza deliberadamente a `127.0.0.1`: ValleOS controla recursos locales y no debe exponerse a la red LAN.

## Calidad y verificación

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run check` ejecuta las cuatro verificaciones. Las operaciones de archivos propuestas por Shadow requieren confirmación en la interfaz; no existe acceso libre al shell desde el dashboard.

Para una base existente creada antes de las migraciones, registra la migración inicial una sola vez después de comprobar que el schema coincide:

```bash
npx prisma migrate resolve --applied 20260820000000_init
```

*Nota de seguridad: Asegúrate de tener tu archivo `.env.local` configurado con tus credenciales de base de datos Neon y tu `ANTHROPIC_API_KEY`.*
