CREATE TABLE `SALES_ORDER_PAYMENT` (
    `payment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` VARCHAR(191) NULL,

    INDEX `SALES_ORDER_PAYMENT_order_id_paid_at_idx` (`order_id`, `paid_at`),
    PRIMARY KEY (`payment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SALES_ORDER_PAYMENT`
ADD CONSTRAINT `SALES_ORDER_PAYMENT_order_id_fkey`
FOREIGN KEY (`order_id`) REFERENCES `SALES_ORDER`(`order_id`)
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `SALES_ORDER_PAYMENT` (`order_id`, `amount`, `paid_at`, `note`)
SELECT `order_id`, `total_amount`, `order_date`, 'Existing paid order'
FROM `SALES_ORDER`
WHERE `is_paid` = true AND `total_amount` > 0;
