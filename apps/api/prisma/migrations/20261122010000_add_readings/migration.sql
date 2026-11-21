-- CreateEnum
CREATE TYPE "ReadingSlot" AS ENUM ('MORNING_FASTING', 'AFTER_BREAKFAST', 'AFTER_LUNCH', 'AFTER_DINNER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "Reading" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,
    "date" DATE NOT NULL,
    "slot" "ReadingSlot" NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Reading_value_check" CHECK ("value" BETWEEN 40 AND 600)
);

-- CreateIndex
CREATE UNIQUE INDEX "Reading_userId_date_slot_key" ON "Reading"("userId", "date", "slot");

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
