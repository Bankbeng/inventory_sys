export function formatSalesOrderNumber(orderNumber: number) {
  return `SO-${String(orderNumber).padStart(2, "0")}`;
}
