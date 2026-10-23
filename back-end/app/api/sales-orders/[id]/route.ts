import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

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

  try {
    const { id } = await params;
    const body = await request.json();

    if (body.is_paid !== undefined && typeof body.is_paid !== "boolean") {
      return NextResponse.json({ error: "is_paid must be a boolean" }, { status: 400 });
    }

    const orderId = parseId(id);
    const order = await prisma.$transaction(async (tx) => {
      if (body.is_paid === true) {
        await tx.$queryRaw<Array<{ order_id: number }>>`
          SELECT order_id FROM SALES_ORDER WHERE order_id = ${orderId} FOR UPDATE
        `;
      }

      const currentOrder = await tx.salesOrder.findUnique({
        where: { order_id: orderId },
      });

      if (!currentOrder) {
        return null;
      }

      const paidTotal = await tx.salesOrderPayment.aggregate({
        where: { order_id: orderId },
        _sum: { amount: true },
      });
      const amountPaid = paidTotal._sum.amount ?? 0;

      if (body.is_paid === false && amountPaid > 0) {
        throw new Error("Payment status cannot be reverted after a payment has been recorded");
      }

      const updateData = {
        ...(body.customer_name !== undefined ? { customer_name: String(body.customer_name).trim() } : {}),
        ...(body.salesperson_id !== undefined ? { salesperson_id: Number(body.salesperson_id) } : {}),
        ...(body.source_vehicle_id !== undefined ? { source_vehicle_id: Number(body.source_vehicle_id) } : {}),
        ...(body.source_warehouse_id !== undefined ? { source_warehouse_id: Number(body.source_warehouse_id) } : {}),
        ...(body.total_amount !== undefined ? { total_amount: Number(body.total_amount) } : {}),
      };
      const updatedOrder = await tx.salesOrder.update({
        where: { order_id: orderId },
        data: updateData,
      });
      const updatedTotal = updatedOrder.total_amount;

      if (amountPaid > updatedTotal + 0.000001) {
        throw new Error("Total amount cannot be less than payments already recorded");
      }

      if (body.is_paid === true && updatedTotal - amountPaid > 0.000001) {
        await tx.salesOrderPayment.create({
          data: {
            order_id: orderId,
            staff_id: session.staffId,
            amount: updatedTotal - amountPaid,
          },
        });
      }

      return tx.salesOrder.update({
        where: { order_id: orderId },
        data: {
          is_paid: body.is_paid === true || amountPaid >= updatedTotal - 0.000001,
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      await tx.salesOrderPayment.deleteMany({
        where: { order_id: parseId(id) },
      });

      await tx.salesOrderDetail.deleteMany({
        where: { order_id: parseId(id) },
      });

      await tx.salesOrder.delete({
        where: { order_id: parseId(id) },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete sales order" },
      { status: 400 },
    );
  }
}
