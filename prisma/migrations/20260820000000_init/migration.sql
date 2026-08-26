-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExerciseLog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "rpe" INTEGER,
    "weight" DOUBLE PRECISION,
    "muscleId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    CONSTRAINT "ExerciseLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BiometricLog" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight" DOUBLE PRECISION,
    "sleep" DOUBLE PRECISION,
    "hrv" INTEGER,
    "calories" INTEGER,
    "steps" INTEGER,
    CONSTRAINT "BiometricLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodLog" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "water" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakdown" JSONB,
    CONSTRAINT "FoodLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "professor" TEXT,
    "schedule" TEXT,
    "color" TEXT NOT NULL DEFAULT '#ff5500',
    "currentGrade" DOUBLE PRECISION DEFAULT 0,
    "absences" INTEGER NOT NULL DEFAULT 0,
    "maxAbsences" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "weight" DOUBLE PRECISION,
    "grade" DOUBLE PRECISION,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkoutSession_date_idx" ON "WorkoutSession"("date");
CREATE INDEX "ExerciseLog_sessionId_idx" ON "ExerciseLog"("sessionId");
CREATE INDEX "ExerciseLog_muscleId_idx" ON "ExerciseLog"("muscleId");
CREATE INDEX "BiometricLog_date_idx" ON "BiometricLog"("date");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX "Transaction_type_date_idx" ON "Transaction"("type", "date");
CREATE INDEX "FoodLog_date_idx" ON "FoodLog"("date");
CREATE INDEX "Course_createdAt_idx" ON "Course"("createdAt");
CREATE INDEX "Assignment_courseId_idx" ON "Assignment"("courseId");
CREATE INDEX "Assignment_status_dueDate_idx" ON "Assignment"("status", "dueDate");
CREATE INDEX "Note_updatedAt_idx" ON "Note"("updatedAt");

ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
