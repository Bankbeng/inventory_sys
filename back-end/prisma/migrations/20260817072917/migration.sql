/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `STAFF` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `password` to the `STAFF` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `STAFF` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `staff` ADD COLUMN `password` VARCHAR(191) NOT NULL,
    ADD COLUMN `username` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `STAFF_username_key` ON `STAFF`(`username`);
