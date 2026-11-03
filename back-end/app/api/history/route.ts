import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { corsHeaders } from "@/lib/cors";

const PAGE_SIZE_MAX = 100;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 50);
  const filterType = url.searchParams.get("type") ?? "all";
  const dateFromValue = url.searchParams.get("dateFrom");
  const dateToValue = url.searchParams.get("dateTo");
  const timezoneOffsetFromValue = url.searchParams.get("timezoneOffsetFrom");
  const timezoneOffsetToValue = url.searchParams.get("timezoneOffsetTo");

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > PAGE_SIZE_MAX ||
    !["all", "SALE", "INBOUND", "OUTBOUND", "TRANSFER"].includes(filterType)
  ) {
    return NextResponse.json(
      { error: "Invalid page, pageSize, or type filter" },
      { status: 400, headers: corsHeaders },
    );
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const getDateStartUtc = (date: string | null) => {
    if (date === null || !datePattern.test(date)) return null;
    const timestamp = Date.parse(`${date}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
      ? timestamp
      : null;
  };
  const dateFromStartUtc = getDateStartUtc(dateFromValue);
  const dateToStartUtc = getDateStartUtc(dateToValue);
  const timezoneOffsetFrom = timezoneOffsetFromValue === null ? 0 : Number(timezoneOffsetFromValue);
  const timezoneOffsetTo = timezoneOffsetToValue === null ? 0 : Number(timezoneOffsetToValue);

  if (
    (dateFromValue !== null && dateFromStartUtc === null) ||
    (dateToValue !== null && dateToStartUtc === null) ||
    (dateFromValue !== null && dateToValue !== null && dateFromValue > dateToValue) ||
    (dateFromValue !== null && (!Number.isInteger(timezoneOffsetFrom) ||
      timezoneOffsetFrom < -840 || timezoneOffsetFrom > 840)) ||
    (dateToValue !== null && (!Number.isInteger(timezoneOffsetTo) ||
      timezoneOffsetTo < -840 || timezoneOffsetTo > 840))
  ) {
    return NextResponse.json(
      { error: "dateFrom and dateTo must be valid YYYY-MM-DD dates in order, with timezone offsets between -840 and 840" },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const filter = filterType === "all"
      ? Prisma.sql`1 = 1`
      : filterType === "SALE"
        ? Prisma.sql`kind = 'sale'`
        : Prisma.sql`kind = 'inventory' AND movement_type = ${filterType}`;
    const dateFilter = dateFromStartUtc !== null && dateToStartUtc !== null
      ? Prisma.sql`occurred_at >= ${new Date(dateFromStartUtc + timezoneOffsetFrom * 60_000)} AND occurred_at < ${new Date(dateToStartUtc + (timezoneOffsetTo + 24 * 60) * 60_000)}`
      : dateFromStartUtc !== null
        ? Prisma.sql`occurred_at >= ${new Date(dateFromStartUtc + timezoneOffsetFrom * 60_000)}`
        : dateToStartUtc !== null
          ? Prisma.sql`occurred_at < ${new Date(dateToStartUtc + (timezoneOffsetTo + 24 * 60) * 60_000)}`
          : null;
    const whereFilter = dateFilter === null
      ? filter
      : Prisma.sql`(${filter}) AND (${dateFilter})`;
    const historyQuery = Prisma.sql`
      SELECT kind, record_id
      FROM (
        SELECT 'inventory' AS kind, transaction_id AS record_id, date_time AS occurred_at,
          transaction_type AS movement_type
        FROM INVENTORY_TRANSACTION
        UNION ALL
        SELECT 'sale' AS kind, order_id AS record_id, order_date AS occurred_at,
          'SALE' AS movement_type
        FROM SALES_ORDER
      ) AS all_history
      WHERE ${whereFilter}
      ORDER BY occurred_at DESC, record_id DESC, kind ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;
    const countQuery = Prisma.sql`
      SELECT COUNT(*) AS total
      FROM (
        SELECT 'inventory' AS kind, date_time AS occurred_at, transaction_type AS movement_type
        FROM INVENTORY_TRANSACTION
        UNION ALL
        SELECT 'sale' AS kind, order_date AS occurred_at, 'SALE' AS movement_type
        FROM SALES_ORDER
      ) AS all_history
      WHERE ${whereFilter}
    `;
    const [pageRows, countRows] = await Promise.all([
      prisma.$queryRaw<Array<{ kind: "inventory" | "sale"; record_id: number }>>(historyQuery),
      prisma.$queryRaw<Array<{ total: bigint | number }>>(countQuery),
    ]);

    const transactionIds = pageRows
      .filter(({ kind }) => kind === "inventory")
      .map(({ record_id }) => record_id);
    const orderIds = pageRows
      .filter(({ kind }) => kind === "sale")
      .map(({ record_id }) => record_id);

    const [transactions, orders] = await Promise.all([
      transactionIds.length
        ? prisma.inventoryTransaction.findMany({
            where: { transaction_id: { in: transactionIds } },
            include: {
              staff: { select: { staff_id: true, staff_name: true } },
              fromWarehouse: true,
              toWarehouse: true,
              fromVehicle: true,
              toVehicle: true,
              details: true,
              acknowledgements: {
                orderBy: { acknowledged_at: "asc" },
                include: { staff: { select: { staff_name: true } } },
              },
            },
          })
        : Promise.resolve([]),
      orderIds.length
        ? prisma.salesOrder.findMany({
            where: { order_id: { in: orderIds } },
            include: {
              salesperson: { select: { staff_id: true, staff_name: true } },
              sourceWarehouse: true,
              sourceVehicle: true,
              details: true,
              acknowledgements: {
                orderBy: { acknowledged_at: "asc" },
                include: { staff: { select: { staff_name: true } } },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const transactionById = new Map(
      transactions.map((transaction) => [transaction.transaction_id, transaction]),
    );
    const orderById = new Map(orders.map((order) => [order.order_id, order]));
    type HistoryResultItem =
      | { type: "inventory"; date: Date; transaction: (typeof transactions)[number] }
      | { type: "SALE"; date: Date; order: (typeof orders)[number] };
    const items: HistoryResultItem[] = [];
    for (const row of pageRows) {
      if (row.kind === "inventory") {
        const transaction = transactionById.get(row.record_id);
        if (transaction) {
          items.push({ type: "inventory", date: transaction.date_time, transaction });
        }
        continue;
      }
      const order = orderById.get(row.record_id);
      if (order) {
        items.push({ type: "SALE", date: order.order_date, order });
      }
    }
    const totalItems = Number(countRows[0]?.total ?? 0);

    return NextResponse.json(
      {
        items,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
        },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Failed to fetch paginated history", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500, headers: corsHeaders },
    );
  }
}
