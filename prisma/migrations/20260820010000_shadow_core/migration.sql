CREATE TABLE "ShadowConversation" (
    "id" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'dashboard',
    "title" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShadowConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShadowMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mood" TEXT,
    "widget" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShadowMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShadowMemory" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShadowMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LifeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LifeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShadowActionAudit" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "toolName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "input" JSONB,
    "result" JSONB,
    "reversible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShadowActionAudit_pkey" PRIMARY KEY ("id")
);

-- Bring the pre-migration ValleOS database up to the indexes and relation
-- policies declared by the baseline schema before adding Shadow Core.
CREATE INDEX IF NOT EXISTS "WorkoutSession_date_idx" ON "WorkoutSession"("date");
CREATE INDEX IF NOT EXISTS "ExerciseLog_sessionId_idx" ON "ExerciseLog"("sessionId");
CREATE INDEX IF NOT EXISTS "ExerciseLog_muscleId_idx" ON "ExerciseLog"("muscleId");
CREATE INDEX IF NOT EXISTS "BiometricLog_date_idx" ON "BiometricLog"("date");
CREATE INDEX IF NOT EXISTS "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX IF NOT EXISTS "Transaction_type_date_idx" ON "Transaction"("type", "date");
CREATE INDEX IF NOT EXISTS "FoodLog_date_idx" ON "FoodLog"("date");
CREATE INDEX IF NOT EXISTS "Course_createdAt_idx" ON "Course"("createdAt");
CREATE INDEX IF NOT EXISTS "Assignment_courseId_idx" ON "Assignment"("courseId");
CREATE INDEX IF NOT EXISTS "Assignment_status_dueDate_idx" ON "Assignment"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "Note_updatedAt_idx" ON "Note"("updatedAt");

ALTER TABLE "ExerciseLog" DROP CONSTRAINT IF EXISTS "ExerciseLog_sessionId_fkey";
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment" DROP CONSTRAINT IF EXISTS "Assignment_courseId_fkey";
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ShadowConversation_externalKey_key" ON "ShadowConversation"("externalKey");
CREATE INDEX "ShadowConversation_channel_lastMessageAt_idx" ON "ShadowConversation"("channel", "lastMessageAt");
CREATE INDEX "ShadowMessage_conversationId_createdAt_idx" ON "ShadowMessage"("conversationId", "createdAt");
CREATE UNIQUE INDEX "ShadowMemory_kind_canonicalKey_content_key" ON "ShadowMemory"("kind", "canonicalKey", "content");
CREATE INDEX "ShadowMemory_subject_active_idx" ON "ShadowMemory"("subject", "active");
CREATE INDEX "ShadowMemory_source_sourceRef_idx" ON "ShadowMemory"("source", "sourceRef");
CREATE INDEX "LifeEvent_occurredAt_idx" ON "LifeEvent"("occurredAt");
CREATE INDEX "LifeEvent_type_occurredAt_idx" ON "LifeEvent"("type", "occurredAt");
CREATE INDEX "LifeEvent_source_sourceId_idx" ON "LifeEvent"("source", "sourceId");
CREATE INDEX "ShadowActionAudit_createdAt_idx" ON "ShadowActionAudit"("createdAt");
CREATE INDEX "ShadowActionAudit_toolName_status_createdAt_idx" ON "ShadowActionAudit"("toolName", "status", "createdAt");
CREATE INDEX "ShadowActionAudit_conversationId_createdAt_idx" ON "ShadowActionAudit"("conversationId", "createdAt");

ALTER TABLE "ShadowMessage" ADD CONSTRAINT "ShadowMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ShadowConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShadowActionAudit" ADD CONSTRAINT "ShadowActionAudit_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ShadowConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
