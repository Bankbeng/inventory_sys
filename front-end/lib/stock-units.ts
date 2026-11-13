export function getUnitsPerPack(size: string): number | null {
  const match = size.trim().match(/^(\d+)\s*[x×]/i);
  if (!match) return null;

  const unitsPerPack = Number(match[1]);
  return Number.isSafeInteger(unitsPerPack) && unitsPerPack > 1 ? unitsPerPack : null;
}

export function formatStockQuantity(quantity: number, size: string, unit: string): string {
  const unitLabel = unit || "units";
  const unitsPerPack = getUnitsPerPack(size);

  if (!unitsPerPack || !Number.isInteger(quantity) || quantity < 0) {
    return `${quantity}${unit ? ` ${unit}` : ""}`;
  }

  const packCount = Math.floor(quantity / unitsPerPack);
  const leftoverUnits = quantity % unitsPerPack;
  if (packCount === 0) return `${quantity} ${unitLabel}`;

  const packLabel = `${packCount} ແກັດ`;
  if (leftoverUnits === 0) return `${packLabel} (${quantity} ${unitLabel})`;

  return `${packLabel} + ${leftoverUnits} ${unitLabel} (${quantity} ${unitLabel} total)`;
}
