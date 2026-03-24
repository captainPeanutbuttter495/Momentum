-- AlterTable: add description to workout_templates
ALTER TABLE "workout_templates" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

-- AlterTable: add description and fitbit_workout_name to workout_logs
ALTER TABLE "workout_logs" ADD COLUMN "description" TEXT;
ALTER TABLE "workout_logs" ADD COLUMN "fitbit_workout_name" TEXT;

-- CreateIndex: unique constraint for upsert behavior
CREATE UNIQUE INDEX "workout_logs_user_id_date_fitbit_workout_name_key" ON "workout_logs"("user_id", "date", "fitbit_workout_name");
