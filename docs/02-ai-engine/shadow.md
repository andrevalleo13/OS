# Shadow AI Engine

Shadow is the core intelligent agent of ValleOS. It operates as the user's alter ego, deeply integrated into the dashboard and the user's Obsidian Vault.

## Persona Rules
- **No Emojis:** Shadow must not use emojis under any circumstance.
- **Markdown Allowed:** Responses can use markdown formatting (bold, lists, code blocks) to structure data properly, especially when reading from Obsidian or the Terminal.
- **No Assistant Tone:** Shadow must not act like a subservient AI (e.g., "Claro que sí, aquí tienes"). It must act like a direct, relaxed friend.
- **No Forced Slang:** Must avoid unnatural slang like "papu", "morra", "güey".
- **Organic Knowledge:** Shadow has access to the Obsidian Vault but is forbidden from saying "According to your notes". It must act as if it inherently remembers the information.
- **Contextual Recall:** Shadow only searches personal memory when the conversation benefits from it; ordinary conversation must stay natural.
- **Silent Curation:** Routine memory writes and note connections happen without announcing them in chat. The audit and restore trail remains available in `/shadow/memory`.
- **UI Metadata:** Shadow automatically appends `<mood>` and `<widget>` tags to trigger UI changes and widgets dynamically.

## Continuous Learning & Proactivity (El Demonio)
Shadow implementa un bucle activo de retroalimentación y autonomía constante a través de su Demonio (`npm run daemon`):
- **Master Rule File:** Reads from `900 - Sistema/Directivas de Shadow.md` on every interaction.
- **Auto-Programming:** If the user corrects Shadow's behavior, Shadow silently executes `append_obsidian_note` to inject this new rule into its Directivas file.
- **Proactive Heartbeat & Cron Jobs:** A background Node process (`scripts/daemon.ts`) wakes up every 2 hours (8 AM - 10 PM) to analyze the context. If urgent actions are required (e.g., missing macros, important notes), Shadow pushes a native macOS notification and sends a WhatsApp message.
- **WhatsApp Integration:** Shadow is connected to a dedicated WhatsApp group ("Shadow") via `whatsapp-web.js`. The user can chat with him remotely from their phone, and Shadow will execute database operations or Obsidian writes in the host machine seamlessly.

## Voice Channel
- **Wake word:** Mientras ValleOS está abierto, el proveedor global espera “Shadow” y acepta la orden en la misma frase o en la siguiente.
- **Visible state:** El orbe clásico, la barra superior y el HUD reflejan escucha, procesamiento y respuesta; el micrófono nunca queda activo sin indicador y puede pausarse en cualquier momento.
- **Spoken response:** Shadow responde usando la voz española disponible en el dispositivo y detiene el reconocimiento durante la reproducción para evitar feedback.
- **Durable transcript:** Solo la instrucción posterior a la activación y la respuesta se guardan. En la página dedicada continúan el hilo activo; desde el resto de ValleOS usan “Voz con Shadow”.
- **Shared memory:** Los turnos de voz atraviesan `askShadow`, por lo que conservan historial, resumen, herramientas y curación silenciosa igual que el chat escrito.
- **Runtime limit:** La escucha web requiere que ValleOS permanezca abierto. La escucha con el navegador cerrado queda reservada para un helper nativo futuro.

## Zettelkasten Architecture (Knowledge Graph)
Shadow leverages a deeply interconnected Zettelkasten system for context retrieval:
- **MOCs (Maps of Content):** Primary indices like `000 - Index (MOC Principal).md` route the knowledge.
- **Status Board:** `001 - Status Board.md` serves as the real-time hub.
- **Entity Metadata:** Every person and concept uses standardized YAML and `## 🔗 Conexiones` blocks.
- **Diary Metrics:** Shadow analyzes the daily templates (`900 - Sistema/Plantillas/Diario.md`).
- **Semantic Index:** Notes are split into durable chunks enriched with summaries and concepts for hybrid retrieval.
- **Life Graph:** Named entities and relations are stored independently from the notes so Shadow can connect facts across sources.
- **Safe Consolidation:** Duplicate, conflicting, or stale memories become review proposals; they are never destructively merged in the background.

## Proactive Intelligence
- Shadow aprende líneas base de comida, entrenamiento, gasto y sueño únicamente cuando existe una muestra suficiente.
- Cada insight conserva evidencia, urgencia, vencimiento y una clave de deduplicación.
- El modo `observe` sólo analiza; `assist` entrega notificaciones y solicita aprobaciones; `autonomous` ejecuta únicamente los permisos habilitados.
- Correos, WhatsApp y eventos de calendario se preparan como trabajos durables. Shadow nunca afirma que fueron enviados antes de que el worker registre el resultado.

## Tool Execution Flow (Backend, System & Web)
Shadow can execute backend tasks, native macOS commands, and browse the web autonomously:
1. `run_terminal_command`: Executes bash/zsh commands directly on the host Mac via `child_process.execSync`, allowing file manipulation and system queries.
2. `search_web` & `read_url`: Surfs the internet using DuckDuckGo to answer current-event questions and extracts clean text using Cheerio.
3. `log_food`: Parses food descriptions, calculates macros, and inserts into DB.
4. `search_obsidian`: Retrieves context from the user's Second Brain.
5. `append_obsidian_note`: Creates memories or updates its own rules.
6. `close_daily_log`: Compiles daily metrics and exports them to a daily note in Obsidian.
