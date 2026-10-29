import { NextResponse } from "next/server";

import { canAccessPage, getCurrentStaff } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

type SaleItem = {
  product_id: number;
  quantity_sold: number;
  sold_at_price: number;
};

function parseId(id: string) {
  const parsed = Number(id);

  if (!Number.isInteger(parsed)) {
    throw new Error("Invalid sales order id");
  }

  return parsed;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const order = await prisma.salesOrder.findUnique({
      where: { order_id: parseId(id) },
      include: {
        salesperson: true,
        sourceVehicle: true,
        sourceWarehouse: true,
        details: true,
        payments: {
          orderBy: { paid_at: "asc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sales order" },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const staff = await getCurrentStaff(session.staffId);
  if (!staff || !(await canAccessPage(staff.role, "/sales-management"))) {
    return NextResponse.json({ error: "Sales order management access required" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (body.is_paid !== undefined && typeof body.is_paid !== "boolean") {
      return NextResponse.json({ error: "is_paid must be a boolean" }, { status: 400 });
    }

    const orderId = parseId(id);
    const order = await prisma.$transaction(async (tx) => {
      if (body.is_paid !== undefined || Array.isArray(body.items) || body.source_vehicle_id !== undefined || body.source_warehouse_id !== undefined) {
        await tx.$queryRaw<Array<{ order_id: number }>>`
          SELECT order_id FROM SALES_ORDER WHERE order_id = ${orderId} FOR UPDATE
        `;
      }

      const currentOrder = await tx.salesOrder.findUnique({
        where: { order_id: orderId },
        include: { details: true },
      });

      if (!currentOrder) {
        return null;
      }

      if (body.items !== undefined && (!Array.isArray(body.items) || body.items.length === 0)) {
        throw new Error("At least one sale item is required");
      }

      const requestedItems: SaleItem[] | undefined = body.items === undefined
        ? undefined
        : body.items.map((item: unknown): SaleItem => {
            if (!item || typeof item !== "object") {
              throw new Error("Each sale item must be an object");
            }
            const saleItem = item as Record<string, unknown>;
            const productId = Number(saleItem.product_id);
            const quantity = Number(saleItem.quantity_sold);
            const unitPrice = Number(saleItem.sold_at_price);

            if (!Number.isInteger(productId) || productId <= 0) {
              throw new Error("Each item must include a valid product_id");
            }
            if (!Number.isInteger(quantity) || quantity <= 0) {
              throw new Error("Each item must include a positive integer quantity");
            }
            if (!Number.isFinite(unitPrice) || unitPrice < 0) {
              throw new Error("Each item must include a valid sold_at_price");
            }

            return { product_id: productId, quantity_sold: quantity, sold_at_price: unitPrice };
          });

      const nextItems: SaleItem[] = requestedItems ?? currentOrder.details.map((detail) => ({
        product_id: detail.product_id,
        quantity_sold: detail.quantity_sold,
        sold_at_price: detail.sold_at_price,
      }));
      const itemMap = nextItems.reduce<Map<number, SaleItem>>((items, item) => {
        const current = items.get(item.product_id);
        if (current) {
          const previousTotal = current.quantity_sold * current.sold_at_price;
          const addedTotal = item.quantity_sold * item.sold_at_price;
          current.quantity_sold += item.quantity_sold;
          current.sold_at_price = (previousTotal + addedTotal) / current.quantity_sold;
        } else {
          items.set(item.product_id, { ...item });
        }
        return items;
      }, new Map<number, SaleItem>());
      const combinedItems = [...itemMap.values()];
      const nextTotal: number = body.items !== undefined
        ? combinedItems.reduce((sum, item) => sum + item.quantity_sold * item.sold_at_price, 0)
        : Number(body.total_amount ?? currentOrder.total_amount);

      if (!Number.isFinite(nextTotal) || nextTotal < 0) {
        throw new Error("Valid total_amount is required");
      }

      const sourceChanged = body.source_vehicle_id !== undefined || body.source_warehouse_id !== undefined;
      const nextSourceVehicleId = !sourceChanged
        ? currentOrder.source_vehicle_id
        : body.source_vehicle_id === undefined || body.source_vehicle_id === null || body.source_vehicle_id === ""
          ? null
          : Number(body.source_vehicle_id);
      const nextSourceWarehouseId = !sourceChanged
        ? currentOrder.source_warehouse_id
        : body.source_warehouse_id === undefined || body.source_warehouse_id === null || body.source_warehouse_id === ""
          ? null
          : Number(body.source_warehouse_id);

      if ((nextSourceVehicleId === null) === (nextSourceWarehouseId === null)) {
        throw new Error("Exactly one source location must be provided");
      }
      if (
        (nextSourceVehicleId !== null && (!Number.isInteger(nextSourceVehicleId) || nextSourceVehicleId <= 0)) ||
        (nextSourceWarehouseId !== null && (!Number.isInteger(nextSourceWarehouseId) || nextSourceWarehouseId <= 0))
      ) {
        throw new Error("Valid source location is required");
      }

      let nextCustomerId = currentOrder.customer_id;
      let nextCustomerName = currentOrder.customer_name;
      if (body.customer_id !== undefined) {
        nextCustomerId = body.customer_id === null || body.customer_id === ""
          ? null
          : Number(body.customer_id);
        if (nextCustomerId !== null) {
          if (!Number.isInteger(nextCustomerId) || nextCustomerId <= 0) {
            throw new Error("Valid customer_id is required");
          }
          const customer = await tx.customer.findUnique({ where: { customer_id: nextCustomerId } });
          if (!customer) {
            throw new Error("Customer not found");
          }
          nextCustomerName = customer.customer_name;
        }
      } else if (body.customer_name !== undefined) {
        nextCustomerName = String(body.customer_name).trim();
        if (!nextCustomerName) {
          throw new Error("Customer name is required");
        }
      }

      const paidTotal = await tx.salesOrderPayment.aggregate({
        where: { order_id: orderId },
        _sum: { amount: true },
      });
      const amountPaid = paidTotal._sum.amount ?? 0;

      if (body.is_paid === false && amountPaid > 0) {
        throw new Error("Payment status cannot be reverted after a payment has been recorded");
      }

      if (amountPaid > nextTotal + 0.000001) {
        throw new Error("Total amount cannot be less than payments already recorded");
      }

      const itemsChanged = body.items !== undefined || sourceChanged;
      if (itemsChanged) {
        for (const item of currentOrder.details) {
          if (currentOrder.source_warehouse_id !== null) {
            await tx.warehouseStock.upsert({
              where: {
                warehouse_id_product_id: {
                  warehouse_id: currentOrder.source_warehouse_id,
                  product_id: item.product_id,
                },
              },
              create: {
                warehouse_id: currentOrder.source_warehouse_id,
                product_id: item.product_id,
                quantity: item.quantity_sold,
              },
              update: { quantity: { increment: item.quantity_sold } },
            });
          } else if (currentOrder.source_vehicle_id !== null) {
            await tx.vehicleStock.upsert({
              where: {
                vehicle_id_product_id: {
                  vehicle_id: currentOrder.source_vehicle_id,
                  product_id: item.product_id,
                },
              },
              create: {
                vehicle_id: currentOrder.source_vehicle_id,
                product_id: item.product_id,
                quantity: item.quantity_sold,
              },
              update: { quantity: { increment: item.quantity_sold } },
            });
          }
        }

        for (const item of combinedItems) {
          if (nextSourceWarehouseId !== null) {
            const stockUpdate = await tx.warehouseStock.updateMany({
              where: {
                warehouse_id: nextSourceWarehouseId,
                product_id: item.product_id,
                quantity: { gte: item.quantity_sold },
              },
              data: { quantity: { decrement: item.quantity_sold } },
            });
            if (stockUpdate.count === 0) {
              const product = await tx.product.findUnique({ where: { product_id: item.product_id } });
              throw new Error(`Insufficient stock for product ${product?.product_name ?? item.product_id} in the selected warehouse`);
            }
          } else if (nextSourceVehicleId !== null) {
            const stockUpdate = await tx.vehicleStock.updateMany({
              where: {
                vehicle_id: nextSourceVehicleId,
                product_id: item.product_id,
                quantity: { gte: item.quantity_sold },
              },
              data: { quantity: { decrement: item.quantity_sold } },
            });
            if (stockUpdate.count === 0) {
              const product = await tx.product.findUnique({ where: { product_id: item.product_id } });
              throw new Error(`Insufficient stock for product ${product?.product_name ?? item.product_id} in the selected vehicle`);
            }
          }
        }

        await tx.salesOrderDetail.deleteMany({ where: { order_id: orderId } });
        for (const item of combinedItems) {
          await tx.salesOrderDetail.create({
            data: {
              order_id: orderId,
              product_id: item.product_id,
              quantity_sold: item.quantity_sold,
              sold_at_price: item.sold_at_price,
            },
          });
        }
      }

      await tx.salesOrder.update({
        where: { order_id: orderId },
        data: {
          customer_id: nextCustomerId,
          customer_name: nextCustomerName,
          ...(body.salesperson_id !== undefined ? { salesperson_id: Number(body.salesperson_id) } : {}),
          source_vehicle_id: nextSourceVehicleId,
          source_warehouse_id: nextSourceWarehouseId,
          total_amount: nextTotal,
        },
      });

      if (body.is_paid === true && nextTotal - amountPaid > 0.000001) {
        await tx.salesOrderPayment.create({
          data: {
            order_id: orderId,
            staff_id: session.staffId,
            amount: nextTotal - amountPaid,
          },
        });
      }

      return tx.salesOrder.update({
        where: { order_id: orderId },
        data: {
          is_paid: body.is_paid === true || amountPaid >= nextTotal - 0.000001,
        },
        include: {
          customer: true,
          sourceWarehouse: true,
          sourceVehicle: true,
          details: { include: { product: true } },
          payments: { orderBy: { paid_at: "asc" } },
        },
      });
    });

    if (!order) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update sales order" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const staff = await getCurrentStaff(session.staffId);
  if (!staff || !(await canAccessPage(staff.role, "/sales-management"))) {
    return NextResponse.json({ error: "Sales order management access required" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const orderId = parseId(id);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ order_id: number }>>`
        SELECT order_id FROM SALES_ORDER WHERE order_id = ${orderId} FOR UPDATE
      `;
      const order = await tx.salesOrder.findUnique({
        where: { order_id: orderId },
        include: { details: true },
      });

      if (!order) {
        throw new Error("Sales order not found");
      }

      for (const item of order.details) {
        if (order.source_warehouse_id !== null) {
          await tx.warehouseStock.upsert({
            where: {
              warehouse_id_product_id: {
                warehouse_id: order.source_warehouse_id,
                product_id: item.product_id,
              },
            },
            create: {
              warehouse_id: order.source_warehouse_id,
              product_id: item.product_id,
              quantity: item.quantity_sold,
            },
            update: { quantity: { increment: item.quantity_sold } },
          });
        } else if (order.source_vehicle_id !== null) {
          await tx.vehicleStock.upsert({
            where: {
              vehicle_id_product_id: {
                vehicle_id: order.source_vehicle_id,
                product_id: item.product_id,
              },
            },
            create: {
              vehicle_id: order.source_vehicle_id,
              product_id: item.product_id,
              quantity: item.quantity_sold,
            },
            update: { quantity: { increment: item.quantity_sold } },
          });
        }
      }

      await tx.salesOrderPayment.deleteMany({ where: { order_id: orderId } });
      await tx.salesOrderDetail.deleteMany({ where: { order_id: orderId } });
      await tx.salesOrderAcknowledgement.deleteMany({ where: { order_id: orderId } });

      await tx.salesOrder.delete({
        where: { order_id: orderId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "Sales order not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete sales order" },
      { status: 400 },
    );
  }
}
