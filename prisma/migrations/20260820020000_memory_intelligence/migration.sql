ALTER TABLE "ShadowConversation"
ADD COLUMN "summarizedMessageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "summaryUpdatedAt" TIMESTAMP(3);

ALTER TABLE "ShadowMemory" ADD COLUMN "entityId" TEXT;

ALTER TABLE "LifeEvent"
ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "processedAt" TIMESTAMP(3);

CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'obsidian',
    "sourceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT,
    "concepts" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceMtime" TIMESTAMP(3) NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "semanticTerms" JSONB,
    "tokenEstimate" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LifeEntity" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "aliases" JSONB,
    "description" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "sourceCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LifeEntity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LifeRelation" (
    "id" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "evidence" TEXT,
    "sourceRef" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LifeRelation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryReview" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "subject" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "memoryIds" JSONB NOT NULL,
    "proposedContent" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "MemoryReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ObsidianRevision" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "beforeContent" TEXT NOT NULL,
    "afterContent" TEXT NOT NULL,
    "beforeHash" TEXT NOT NULL,
    "afterHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" TIMESTAMP(3),
    CONSTRAINT "ObsidianRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LifeEvent_dedupeKey_key" ON "LifeEvent"("dedupeKey");
CREATE INDEX "LifeEvent_status_priority_occurredAt_idx" ON "LifeEvent"("status", "priority", "occurredAt");
CREATE INDEX "ShadowMemory_entityId_active_idx" ON "ShadowMemory"("entityId", "active");
CREATE UNIQUE INDEX "KnowledgeDocument_sourceKey_key" ON "KnowledgeDocument"("sourceKey");
CREATE INDEX "KnowledgeDocument_active_indexedAt_idx" ON "KnowledgeDocument"("active", "indexedAt");
CREATE INDEX "KnowledgeDocument_path_idx" ON "KnowledgeDocument"("path");
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_position_key" ON "KnowledgeChunk"("documentId", "position");
CREATE INDEX "KnowledgeChunk_documentId_position_idx" ON "KnowledgeChunk"("documentId", "position");
CREATE UNIQUE INDEX "LifeEntity_kind_canonicalKey_key" ON "LifeEntity"("kind", "canonicalKey");
CREATE INDEX "LifeEntity_name_idx" ON "LifeEntity"("name");
CREATE INDEX "LifeEntity_lastSeenAt_idx" ON "LifeEntity"("lastSeenAt");
CREATE UNIQUE INDEX "LifeRelation_fromEntityId_toEntityId_type_key" ON "LifeRelation"("fromEntityId", "toEntityId", "type");
CREATE INDEX "LifeRelation_fromEntityId_active_idx" ON "LifeRelation"("fromEntityId", "active");
CREATE INDEX "LifeRelation_toEntityId_active_idx" ON "LifeRelation"("toEntityId", "active");
CREATE INDEX "MemoryReview_status_createdAt_idx" ON "MemoryReview"("status", "createdAt");
CREATE INDEX "MemoryReview_subject_status_idx" ON "MemoryReview"("subject", "status");
CREATE INDEX "ObsidianRevision_status_createdAt_idx" ON "ObsidianRevision"("status", "createdAt");
CREATE INDEX "ObsidianRevision_path_createdAt_idx" ON "ObsidianRevision"("path", "createdAt");

ALTER TABLE "ShadowMemory" ADD CONSTRAINT "ShadowMemory_entityId_fkey"
FOREIGN KEY ("entityId") REFERENCES "LifeEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LifeRelation" ADD CONSTRAINT "LifeRelation_fromEntityId_fkey"
FOREIGN KEY ("fromEntityId") REFERENCES "LifeEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LifeRelation" ADD CONSTRAINT "LifeRelation_toEntityId_fkey"
FOREIGN KEY ("toEntityId") REFERENCES "LifeEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
