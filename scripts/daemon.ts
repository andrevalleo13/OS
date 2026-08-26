import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import type { Message } from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
dotenv.config({ path: '.env.local' });

const shadowRuntime = Promise.all([
    import('../src/app/actions/shadow'),
    import('../src/features/shadow/knowledge-index'),
    import('../src/features/shadow/memory-consolidation'),
    import('../src/features/shadow/conversation-summary'),
    import('../src/features/shadow/proactivity'),
    import('../src/features/shadow/autonomy'),
]).then(([shadow, knowledge, consolidation, summaries, proactivity, autonomy]) => ({
    ...shadow,
    ...knowledge,
    ...consolidation,
    ...summaries,
    ...proactivity,
    ...autonomy,
}));
const allowedSenders = new Set(
    (process.env.WHATSAPP_ALLOWED_SENDERS ?? '').split(',').map(value => value.trim()).filter(Boolean)
);
const shadowGroupName = process.env.WHATSAPP_SHADOW_GROUP ?? 'Shadow';
const authPath = path.resolve(
    process.env.WHATSAPP_AUTH_PATH ?? path.join(os.homedir(), '.valleos', 'whatsapp-auth')
);
const execFileAsync = promisify(execFile);

async function notify(title: string, message: string) {
    const script = 'on run argv\ndisplay notification (item 2 of argv) with title (item 1 of argv)\nend run';
    await execFileAsync('osascript', ['-e', script, '--', title, message], { timeout: 5_000 });
}

// 1. Inicializar WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authPath }),
});

client.on('qr', (qr) => {
    console.log('🤖 Escanea este QR en tu WhatsApp para vincular a Shadow:');
    qrcode.generate(qr, { small: true });
});

let whatsappReady = false;
client.on('ready', () => {
    whatsappReady = true;
    console.log('⚡️ Shadow WhatsApp Bot está ONLINE y conectado!');
    void notify('ValleOS', 'Shadow Daemon iniciado y conectado a WhatsApp.')
        .catch(error => console.error('[WhatsApp] No se pudo mostrar la notificación de inicio:', error));
});

client.on('disconnected', () => {
    whatsappReady = false;
});

const botMessageIds = new Set<string>();
const botResponseBodies = new Set<string>();

async function handleWhatsAppMessage(msg: Message) {
    // message_create atrapa tanto los mensajes que recibes como los que TÚ envías
    // Esto es vital si usas el chat de "Tú" (Mensajes a ti mismo)
    const candidateChatId = msg.fromMe ? msg.to : msg.from;
    if (typeof candidateChatId !== 'string') return;
    const isPotentialGroup = candidateChatId.endsWith('@g.us');
    const isMessageToMyself = !isPotentialGroup && msg.to === msg.from;
    if (!isPotentialGroup && !isMessageToMyself) return;

    // whatsapp-web.js puede reproducir eventos viejos cuyo chat ya no es
    // resoluble. Son irrelevantes para Shadow y no deben tumbar el daemon.
    const chat = await msg.getChat().catch(() => null);
    if (!chat) return;
    
    // El bot responderá si:
    // 1. Es el grupo llamado "Shadow"
    // 2. O es un mensaje que te mandaste a ti mismo (tu propio número)
    const isShadowGroup = chat.isGroup && chat.name.toLowerCase() === shadowGroupName.toLowerCase();
    const sender = msg.author ?? msg.from;

    if (isShadowGroup || isMessageToMyself) {
        const messageId = msg.id._serialized;
        if (botMessageIds.delete(messageId)) return;
        if (botResponseBodies.delete(msg.body)) return;
        if (isShadowGroup && !msg.fromMe && !allowedSenders.has(sender)) {
            console.warn(`[WhatsApp] Mensaje rechazado de remitente no autorizado: ${sender}`);
            return;
        }

        console.log(`[WhatsApp] Mensaje interceptado: ${msg.body}`);
        
        try {
            const { askShadow } = await shadowRuntime;
            const response = await askShadow({
                message: msg.body,
                conversationKey: `whatsapp:${chat.id._serialized}`,
                channel: 'whatsapp',
            });
            
            botResponseBodies.add(response.text);
            const sent = await chat.sendMessage(response.text);
            botMessageIds.add(sent.id._serialized);
        } catch (error) {
            console.error("Error contactando a Shadow:", error);
            await chat.sendMessage("Shadow tuvo un fallo local. Revisa la terminal.")
                .catch(sendError => console.error('[WhatsApp] También falló el mensaje de error:', sendError));
        }
    }
}

client.on('message_create', (msg) => {
    void handleWhatsAppMessage(msg).catch(error => {
        const message = error instanceof Error ? error.message : 'evento no resoluble';
        console.warn(`[WhatsApp] Se ignoró un evento de Shadow: ${message}`);
    });
});

void client.initialize().catch(error => {
    whatsappReady = false;
    console.error('[WhatsApp] Falló la inicialización:', error);
});

let indexRunning = false;
async function refreshKnowledgeIndex() {
    if (indexRunning) return;
    indexRunning = true;
    try {
        const { indexKnowledgeVault } = await shadowRuntime;
        const result = await indexKnowledgeVault({ maxDocuments: 20 });
        if (result.indexed > 0) console.log(`[Memory] ${result.indexed} notas actualizadas en el índice.`);
    } catch (error) {
        console.error('[Memory] Falló la indexación incremental:', error);
    } finally {
        indexRunning = false;
    }
}

void refreshKnowledgeIndex();

cron.schedule('*/15 8-23 * * *', () => {
    void refreshKnowledgeIndex();
});

cron.schedule('*/30 8-23 * * *', () => {
    void shadowRuntime
        .then(({ summarizeStaleConversations }) => summarizeStaleConversations())
        .catch(error => console.error('[Memory] Falló la compactación:', error));
});

cron.schedule('30 3 * * *', () => {
    void shadowRuntime
        .then(({ consolidateShadowMemories }) => consolidateShadowMemories())
        .catch(error => console.error('[Memory] Falló la consolidación:', error));
});

let autonomyRunning = false;
async function dispatchWhatsAppJobs() {
    if (!whatsappReady) return 0;
    const { claimNextAutomationJob, completeAutomationJob, failAutomationJob, validateAutomationPayload } = await shadowRuntime;
    let completed = 0;
    for (let index = 0; index < 5; index += 1) {
        const job = await claimNextAutomationJob(['whatsapp.send']);
        if (!job) break;
        try {
            const payload = validateAutomationPayload('whatsapp.send', job.payload) as { recipient: string; body: string };
            const chats = await client.getChats();
            const matches = chats.filter(chat =>
                chat.id._serialized === payload.recipient || chat.name.toLowerCase() === payload.recipient.toLowerCase()
            );
            if (matches.length !== 1) throw new Error(`El destinatario debe coincidir con un único chat; coincidencias: ${matches.length}.`);
            const sent = await matches[0].sendMessage(payload.body);
            botMessageIds.add(sent.id._serialized);
            botResponseBodies.add(payload.body);
            await completeAutomationJob(job.id, job.executionId, { channel: 'whatsapp', messageId: sent.id._serialized });
            completed += 1;
        } catch (error) {
            await failAutomationJob(job, job.executionId, error);
        }
    }
    return completed;
}

async function runAutonomyCycle() {
    if (autonomyRunning) return;
    autonomyRunning = true;
    try {
        const { runProactiveCycle, recoverStuckAutomationJobs, executeReadyAutomationJobs } = await shadowRuntime;
        await recoverStuckAutomationJobs();
        const proactive = await runProactiveCycle();
        const local = await executeReadyAutomationJobs();
        const whatsapp = await dispatchWhatsAppJobs();
        if (proactive.insights > 0 || local.completed > 0 || whatsapp > 0) {
            console.log(`[Autonomy] ${proactive.patterns} patrones, ${proactive.insights} insights, ${local.completed + whatsapp} acciones.`);
        }
    } catch (error) {
        console.error('[Autonomy] Falló el ciclo:', error);
    } finally {
        autonomyRunning = false;
    }
}

void runAutonomyCycle();
cron.schedule('*/15 8-23 * * *', () => {
    void runAutonomyCycle();
});
cron.schedule('* * * * *', () => {
    void shadowRuntime
        .then(async ({ recoverStuckAutomationJobs, executeReadyAutomationJobs }) => {
            await recoverStuckAutomationJobs();
            await executeReadyAutomationJobs();
            await dispatchWhatsAppJobs();
        })
        .catch(error => console.error('[Autonomy] Falló el worker:', error));
});

async function shutdown(signal: string) {
    console.log(`[Daemon] ${signal}; cerrando conexiones.`);
    try { await client.destroy(); } finally { process.exit(0); }
}
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });

console.log("Iniciando ValleOS Shadow Daemon...");
