const lakFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "LAK",
  currencyDisplay: "code",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number) {
  return lakFormatter.format(value);
}