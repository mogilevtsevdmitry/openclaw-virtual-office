-- AlterTable: add historySnapshot to tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "history_snapshot" JSONB;
