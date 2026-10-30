CREATE INDEX `INVENTORY_TRANSACTION_date_time_transaction_id_idx`
ON `INVENTORY_TRANSACTION` (`date_time`, `transaction_id`);

CREATE INDEX `SALES_ORDER_order_date_order_id_idx`
ON `SALES_ORDER` (`order_date`, `order_id`);
