import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const orders = await prisma.salesOrder.findMany({
      orderBy: [{ order_date: "desc" }, { order_id: "desc" }],
      include: {
        salesperson: true,
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
    });

    return NextResponse.json(orders, { headers: corsHeaders });
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

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Each item must include a valid quantity");
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

    const totalAmount = Number(
      body.total_amount ?? normalizedItems.reduce((sum, item) => sum + item.quantity_sold * item.sold_at_price, 0),
    );

    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      return NextResponse.json(
        { error: "Valid total_amount is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.salesOrder.create({
        data: {
          customer_name: customerName,
          customer_id: customer?.customer_id ?? null,
          salesperson_id: salespersonId,
          source_vehicle_id: sourceVehicleId,
          source_warehouse_id: sourceWarehouseId,
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
        const product = await tx.product.findUnique({
          where: { product_id: item.product_id },
        });

        if (!product) {
          throw new Error(`Product ${item.product_id} not found`);
        }

        if (sourceWarehouseId !== null) {
          const stock = await tx.warehouseStock.findUnique({
            where: {
              warehouse_id_product_id: {
                warehouse_id: sourceWarehouseId,
                product_id: item.product_id,
              },
            },
          });

          if (!stock || stock.quantity < item.quantity_sold) {
            throw new Error(`Insufficient stock for product ${product.product_name} in the selected warehouse`);
          }

          await tx.warehouseStock.update({
            where: {
              warehouse_id_product_id: {
                warehouse_id: sourceWarehouseId,
                product_id: item.product_id,
              },
            },
            data: {
              quantity: stock.quantity - item.quantity_sold,
            },
          });
        } else if (sourceVehicleId !== null) {
          const stock = await tx.vehicleStock.findUnique({
            where: {
              vehicle_id_product_id: {
                vehicle_id: sourceVehicleId,
                product_id: item.product_id,
              },
            },
          });

          if (!stock || stock.quantity < item.quantity_sold) {
            throw new Error(`Insufficient stock for product ${product.product_name} in the selected vehicle`);
          }

          await tx.vehicleStock.update({
            where: {
              vehicle_id_product_id: {
                vehicle_id: sourceVehicleId,
                product_id: item.product_id,
              },
            },
            data: {
              quantity: stock.quantity - item.quantity_sold,
            },
          });
        }

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
          salesperson: true,
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
