-- AlterTable
ALTER TABLE `Message` ADD COLUMN `contentSummary` TEXT NULL,
    ADD COLUMN `hasFullContent` BOOLEAN NOT NULL DEFAULT false;
