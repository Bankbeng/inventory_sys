CREATE TABLE `DELETED_SALES_ORDER` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `order_number` INTEGER NOT NULL,
    `order_snapshot` JSON NOT NULL,
    `deleted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_by_name` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,

    INDEX `DELETED_SALES_ORDER_order_number_idx` (`order_number`),
    INDEX `DELETED_SALES_ORDER_deleted_at_idx` (`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
