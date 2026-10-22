type DateValue = string | number | Date;

function toDate(value: DateValue) {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: DateValue) {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB");
}

export function formatDateTime(value: DateValue, includeSeconds = false) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
  });
}
