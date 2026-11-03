import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { corsHeaders } from "@/lib/cors";

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pageValue = url.searchParams.get("page");
    const pageSizeValue = url.searchParams.get("pageSize");
    const search = url.searchParams.get("search")?.trim() ?? "";
    const dateFromValue = url.searchParams.get("dateFrom") ?? url.searchParams.get("date");
    const dateToValue = url.searchParams.get("dateTo") ?? url.searchParams.get("date");
    const timezoneOffsetFromValue = url.searchParams.get("timezoneOffsetFrom") ?? url.searchParams.get("timezoneOffset");
    const timezoneOffsetToValue = url.searchParams.get("timezoneOffsetTo") ?? url.searchParams.get("timezoneOffset");
    const isPaginated = pageValue !== null || pageSizeValue !== null || search !== "" ||
      dateFromValue !== null || dateToValue !== null;
    const page = pageValue === null ? 1 : Number(pageValue);
    const pageSize = pageSizeValue === null ? 50 : Number(pageSizeValue);
    const orderNumberSearch = search.replace(/^SO-/i, "").trim();

    if (
      isPaginated &&
      (!Number.isInteger(page) || page < 1 ||
        !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    ) {
      return NextResponse.json(
        { error: "page must be a positive integer and pageSize must be between 1 and 100" },
        { status: 400, headers: corsHeaders },
      );
    }

    const conditions: Prisma.SalesOrderWhereInput[] = [];
    if (search) {
      conditions.push({
          OR: [
            ...(Number.isInteger(Number(search)) && Number(search) > 0
              ? [{ order_id: Number(search) }]
              : []),
            ...(Number.isInteger(Number(orderNumberSearch)) && Number(orderNumberSearch) > 0
              ? [{ order_number: Number(orderNumberSearch) }]
              : []),
            { customer_name: { contains: search } },
            { salesperson: { staff_name: { contains: search } } },
            { sourceWarehouse: { warehouse_name: { contains: search } } },
            { sourceVehicle: { vehicle_name: { contains: search } } },
          ],
      });
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

    if (dateFromStartUtc !== null || dateToStartUtc !== null) {
      const orderDate: Prisma.DateTimeFilter = {};
      if (dateFromStartUtc !== null) {
        orderDate.gte = new Date(dateFromStartUtc + timezoneOffsetFrom * 60_000);
      }
      if (dateToStartUtc !== null) {
        orderDate.lt = new Date(dateToStartUtc + (timezoneOffsetTo + 24 * 60) * 60_000);
      }
      conditions.push({
        order_date: orderDate,
      });
    }

    const where: Prisma.SalesOrderWhereInput | undefined = conditions.length
      ? { AND: conditions }
      : undefined;

    const query: Prisma.SalesOrderFindManyArgs = {
      ...(where ? { where } : {}),
      orderBy: [{ order_date: "desc" }, { order_id: "desc" }],
      ...(isPaginated ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
      include: {
        salesperson: {
          select: { staff_id: true, staff_name: true },
        },
        customer: true,
        sourceVehicle: true,
        sourceWarehouse: true,
        details: {
          include: {
            product: true,
          },
        },
        payments: {
          orderBy: { paid_at: "asc" },
          include: {
            recordedBy: {
              select: { staff_name: true },
            },
          },
        },
        acknowledgements: {
          orderBy: { acknowledged_at: "asc" },
          include: {
            staff: { select: { staff_name: true } },
          },
        },
      },
    };
    const [orders, totalItems] = await Promise.all([
      prisma.salesOrder.findMany(query),
      isPaginated ? prisma.salesOrder.count(where ? { where } : undefined) : Promise.resolve(0),
    ]);

    return NextResponse.json(
      isPaginated
        ? {
            items: orders,
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / pageSize),
            },
          }
        : orders,
      { headers: corsHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch sales orders" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    const body = await request.json();
    const rawItems = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.products)
        ? body.products
        : [];

    const customerId = body.customer_id === undefined || body.customer_id === null || body.customer_id === ""
      ? null
      : Number(body.customer_id);
    const legacyCustomerName = typeof body.customer_name === "string" ? body.customer_name.trim() : "";
    const salespersonId = session.staffId;
    const sourceVehicleId = body.source_vehicle_id === undefined || body.source_vehicle_id === null || body.source_vehicle_id === ""
      ? null
      : Number(body.source_vehicle_id);
    const sourceWarehouseId = body.source_warehouse_id === undefined || body.source_warehouse_id === null || body.source_warehouse_id === ""
      ? null
      : Number(body.source_warehouse_id);
    const isPaid = body.is_paid === undefined ? true : body.is_paid;
    const includeTax = body.include_tax === undefined ? false : body.include_tax;

    if (customerId !== null && (!Number.isInteger(customerId) || customerId <= 0)) {
      return NextResponse.json(
        { error: "Valid customer_id is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const customer = customerId === null
      ? null
      : await prisma.customer.findUnique({ where: { customer_id: customerId } });
    if (customerId !== null && !customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404, headers: corsHeaders },
      );
    }
    const customerName = customer?.customer_name ?? legacyCustomerName;
    if (!customerName) {
      return NextResponse.json(
        { error: "customer_id is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (typeof isPaid !== "boolean") {
      return NextResponse.json(
        { error: "is_paid must be a boolean" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (typeof includeTax !== "boolean") {
      return NextResponse.json(
        { error: "include_tax must be a boolean" },
        { status: 400, headers: corsHeaders },
      );
    }

    if ((sourceVehicleId === null && sourceWarehouseId === null) || (sourceVehicleId !== null && sourceWarehouseId !== null)) {
      return NextResponse.json(
        { error: "Exactly one source location must be provided: source_vehicle_id or source_warehouse_id" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { error: "At least one sale item is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const normalizedItems = rawItems.map((item) => {
      const productId = Number(item?.product_id ?? item?.productId);
      const quantity = Number(item?.quantity_sold ?? item?.quantity ?? 1);
      const unitPrice = Number(item?.sold_at_price ?? item?.unit_price ?? item?.price ?? 0);

      if (!Number.isInteger(productId) || productId <= 0) {
        throw new Error("Each item must include a valid product_id");
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Each item must include a positive integer quantity");
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("Each item must include a valid sold_at_price");
      }

      return {
        product_id: productId,
        quantity_sold: quantity,
        sold_at_price: unitPrice,
      };
    });

    const itemSubtotal = normalizedItems.reduce(
      (sum, item) => sum + item.quantity_sold * item.sold_at_price,
      0,
    );
    const discountAmount = body.discount_amount === undefined ? 0 : Number(body.discount_amount);

    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > itemSubtotal) {
      return NextResponse.json(
        { error: "discount_amount must be between 0 and the item subtotal" },
        { status: 400, headers: corsHeaders },
      );
    }

    const taxRate = includeTax ? 0.1 : 0;
    const discountedSubtotal = itemSubtotal - discountAmount;
    const totalBeforeTax = body.discount_amount === undefined
      ? Number(body.total_amount ?? discountedSubtotal)
      : discountedSubtotal;
    const taxAmount = Math.round((totalBeforeTax * taxRate + Number.EPSILON) * 100) / 100;
    const totalAmount = totalBeforeTax + taxAmount;

    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      return NextResponse.json(
        { error: "Valid total_amount is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      for (const item of normalizedItems) {
        const product = await tx.product.findUnique({
          where: { product_id: item.product_id },
        });

        if (!product) {
          throw new Error(`Product ${item.product_id} not found`);
        }

        if (sourceWarehouseId !== null) {
          const stockUpdate = await tx.warehouseStock.updateMany({
            where: {
              warehouse_id: sourceWarehouseId,
              product_id: item.product_id,
              quantity: { gte: item.quantity_sold },
            },
            data: {
              quantity: { decrement: item.quantity_sold },
            },
          });

          if (stockUpdate.count === 0) {
            throw new Error(`Insufficient stock for product ${product.product_name} in the selected warehouse`);
          }
        } else if (sourceVehicleId !== null) {
          const stockUpdate = await tx.vehicleStock.updateMany({
            where: {
              vehicle_id: sourceVehicleId,
              product_id: item.product_id,
              quantity: { gte: item.quantity_sold },
            },
            data: {
              quantity: { decrement: item.quantity_sold },
            },
          });

          if (stockUpdate.count === 0) {
            throw new Error(`Insufficient stock for product ${product.product_name} in the selected vehicle`);
          }
        }
      }

      const [numberSequence] = await tx.$queryRaw<{ next_number: number }[]>`
        SELECT next_number
        FROM SALES_ORDER_NUMBER_SEQUENCE
        WHERE sequence_id = 1
        FOR UPDATE
      `;
      if (!numberSequence) {
        throw new Error("Sales order number sequence is not configured");
      }

      await tx.salesOrderNumberSequence.update({
        where: { sequence_id: 1 },
        data: { next_number: { increment: 1 } },
      });

      const createdOrder = await tx.salesOrder.create({
        data: {
          order_number: numberSequence.next_number,
          customer_name: customerName,
          customer_id: customer?.customer_id ?? null,
          salesperson_id: salespersonId,
          source_vehicle_id: sourceVehicleId,
          source_warehouse_id: sourceWarehouseId,
          discount_amount: discountAmount,
          tax_rate: taxRate,
          total_amount: totalAmount,
          is_paid: isPaid,
        },
      });

      if (isPaid && totalAmount > 0) {
        await tx.salesOrderPayment.create({
          data: {
            order_id: createdOrder.order_id,
            staff_id: session.staffId,
            amount: totalAmount,
          },
        });
      }

      for (const item of normalizedItems) {
        await tx.salesOrderDetail.create({
          data: {
            order_id: createdOrder.order_id,
            product_id: item.product_id,
            quantity_sold: item.quantity_sold,
            sold_at_price: Number(item.sold_at_price),
          },
        });
      }

      return tx.salesOrder.findUnique({
        where: { order_id: createdOrder.order_id },
        include: {
          salesperson: {
            select: { staff_id: true, staff_name: true },
          },
          sourceVehicle: true,
          sourceWarehouse: true,
          details: {
            include: {
              product: true,
            },
          },
          payments: {
            orderBy: { paid_at: "asc" },
            include: {
              recordedBy: {
                select: { staff_name: true },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(order, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create sales order",
      },
      { status: 400, headers: corsHeaders },
    );
  }
}
