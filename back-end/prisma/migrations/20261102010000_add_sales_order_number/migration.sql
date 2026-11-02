ALTER TABLE `SALES_ORDER`
ADD COLUMN `order_number` INTEGER NULL;

UPDATE `SALES_ORDER` AS orders
JOIN (
    SELECT `order_id`, ROW_NUMBER() OVER (ORDER BY `order_date`, `order_id`) AS `order_number`
    FROM `SALES_ORDER`
) AS numbered_orders ON numbered_orders.`order_id` = orders.`order_id`
SET orders.`order_number` = numbered_orders.`order_number`;

ALTER TABLE `SALES_ORDER`
MODIFY COLUMN `order_number` INTEGER NOT NULL;

CREATE UNIQUE INDEX `SALES_ORDER_order_number_key`
ON `SALES_ORDER` (`order_number`);

CREATE TABLE `SALES_ORDER_NUMBER_SEQUENCE` (
    `sequence_id` INTEGER NOT NULL,
    `next_number` INTEGER NOT NULL,

    PRIMARY KEY (`sequence_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `SALES_ORDER_NUMBER_SEQUENCE` (`sequence_id`, `next_number`)
SELECT 1, COALESCE(MAX(`order_number`), 0) + 1
FROM `SALES_ORDER`;
