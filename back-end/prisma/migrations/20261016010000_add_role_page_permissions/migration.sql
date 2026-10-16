CREATE TABLE `ROLE_PAGE_PERMISSION` (
    `role_name` VARCHAR(191) NOT NULL,
    `page_path` VARCHAR(191) NOT NULL,
    `can_access` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`role_name`, `page_path`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
