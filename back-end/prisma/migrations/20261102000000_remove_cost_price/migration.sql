-- Drop cost price from products; keep retail price as the single product price.
ALTER TABLE `PRODUCT`
DROP COLUMN `cost_price`;
