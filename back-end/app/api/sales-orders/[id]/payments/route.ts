import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function parseId(id: string) {
  const parsed = Number(id);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid sales order id");
  }

  return parsed;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const orderId = parseId(id);
    const body = await request.json();
    const amount = Number(body.amount);
    const note = body.note === undefined || body.note === null ? null : String(body.note).trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be a positive number" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (body.note !== undefined && body.note !== null && typeof body.note !== "string") {
      return NextResponse.json(
        { error: "Payment note must be a string" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (note !== null && note.length > 191) {
      return NextResponse.json(
        { error: "Payment note must be 191 characters or fewer" },
        { status: 400, headers: corsHeaders },
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw<Array<{ order_id: number }>>`
        SELECT order_id FROM SALES_ORDER WHERE order_id = ${orderId} FOR UPDATE
      `;

      if (lockedOrders.length === 0) {
        return null;
      }

      const currentOrder = await tx.salesOrder.findUniqueOrThrow({
        where: { order_id: orderId },
      });
      const payments = await tx.salesOrderPayment.aggregate({
        where: { order_id: orderId },
        _sum: { amount: true },
      });
      const amountPaid = payments._sum.amount ?? 0;
      const outstanding = Math.max(0, currentOrder.total_amount - amountPaid);

      if (amount > outstanding + 0.000001) {
        throw new Error(`Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}`);
      }

      await tx.salesOrderPayment.create({
        data: {
          order_id: orderId,
          amount,
          ...(note ? { note } : {}),
        },
      });

      const isPaid = amountPaid + amount >= currentOrder.total_amount - 0.000001;
      await tx.salesOrder.update({
        where: { order_id: orderId },
        data: { is_paid: isPaid },
      });

      return tx.salesOrder.findUnique({
        where: { order_id: orderId },
        include: {
          payments: {
            orderBy: { paid_at: "asc" },
          },
        },
      });
    });

    if (!order) {
      return NextResponse.json(
        { error: "Sales order not found" },
        { status: 404, headers: corsHeaders },
      );
    }

    return NextResponse.json(order, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record payment" },
      { status: 400, headers: corsHeaders },
    );
  }
}
