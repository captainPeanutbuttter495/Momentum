-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "height_feet" INTEGER NOT NULL,
    "height_inches" INTEGER NOT NULL,
    "weight_lbs" DOUBLE PRECISION NOT NULL,
    "gender" TEXT NOT NULL,
    "activity_level" DOUBLE PRECISION NOT NULL,
    "target_weight_lbs" DOUBLE PRECISION NOT NULL,
    "weekly_rate_lbs" DOUBLE PRECISION NOT NULL,
    "bmr" DOUBLE PRECISION NOT NULL,
    "tdee" DOUBLE PRECISION NOT NULL,
    "daily_calorie_target" INTEGER NOT NULL,
    "protein_pct" INTEGER NOT NULL,
    "carb_pct" INTEGER NOT NULL,
    "fat_pct" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
