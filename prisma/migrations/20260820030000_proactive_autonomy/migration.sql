CREATE TABLE "ShadowPattern" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShadowPattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShadowInsight" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "patternId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rationale" TEXT,
    "evidence" JSONB,
    "urgency" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "suggestedActionType" TEXT,
    "suggestedActionInput" JSONB,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "actedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShadowInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShadowAutonomyPolicy" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'assist',
    "quietStart" TEXT NOT NULL DEFAULT '23:00',
    "quietEnd" TEXT NOT NULL DEFAULT '08:00',
    "dailyDeliveryLimit" INTEGER NOT NULL DEFAULT 6,
    "allowMacNotifications" BOOLEAN NOT NULL DEFAULT true,
    "allowWhatsAppSelf" BOOLEAN NOT NULL DEFAULT true,
    "allowEmailDrafts" BOOLEAN NOT NULL DEFAULT true,
    "allowExternalSend" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShadowAutonomyPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShadowAutomationJob" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "insightId" TEXT,
    "actionType" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShadowAutomationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShadowAutomationExecution" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "result" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "ShadowAutomationExecution_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ShadowAutonomyPolicy" ("id", "updatedAt")
VALUES ('primary', CURRENT_TIMESTAMP);

CREATE UNIQUE INDEX "ShadowPattern_signature_key" ON "ShadowPattern"("signature");
CREATE INDEX "ShadowPattern_status_kind_lastObservedAt_idx" ON "ShadowPattern"("status", "kind", "lastObservedAt");
CREATE INDEX "ShadowPattern_subject_status_idx" ON "ShadowPattern"("subject", "status");
CREATE UNIQUE INDEX "ShadowInsight_dedupeKey_key" ON "ShadowInsight"("dedupeKey");
CREATE INDEX "ShadowInsight_status_availableAt_urgency_idx" ON "ShadowInsight"("status", "availableAt", "urgency");
CREATE INDEX "ShadowInsight_type_createdAt_idx" ON "ShadowInsight"("type", "createdAt");
CREATE INDEX "ShadowInsight_patternId_status_idx" ON "ShadowInsight"("patternId", "status");
CREATE UNIQUE INDEX "ShadowAutomationJob_idempotencyKey_key" ON "ShadowAutomationJob"("idempotencyKey");
CREATE INDEX "ShadowAutomationJob_status_scheduledFor_idx" ON "ShadowAutomationJob"("status", "scheduledFor");
CREATE INDEX "ShadowAutomationJob_actionType_status_scheduledFor_idx" ON "ShadowAutomationJob"("actionType", "status", "scheduledFor");
CREATE INDEX "ShadowAutomationJob_insightId_status_idx" ON "ShadowAutomationJob"("insightId", "status");
CREATE UNIQUE INDEX "ShadowAutomationExecution_jobId_attempt_key" ON "ShadowAutomationExecution"("jobId", "attempt");
CREATE INDEX "ShadowAutomationExecution_status_startedAt_idx" ON "ShadowAutomationExecution"("status", "startedAt");

ALTER TABLE "ShadowInsight" ADD CONSTRAINT "ShadowInsight_patternId_fkey"
FOREIGN KEY ("patternId") REFERENCES "ShadowPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShadowAutomationJob" ADD CONSTRAINT "ShadowAutomationJob_insightId_fkey"
FOREIGN KEY ("insightId") REFERENCES "ShadowInsight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShadowAutomationExecution" ADD CONSTRAINT "ShadowAutomationExecution_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "ShadowAutomationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
