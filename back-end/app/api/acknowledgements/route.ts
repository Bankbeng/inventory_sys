import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
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
    const recordType = body?.record_type;
    const recordId = Number(body?.record_id);

    if (!["inventory", "sale"].includes(recordType)) {
      return NextResponse.json(
        { error: "record_type must be inventory or sale" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return NextResponse.json(
        { error: "record_id must be a positive integer" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (recordType === "inventory") {
      const transaction = await prisma.inventoryTransaction.findUnique({
        where: { transaction_id: recordId },
        select: { transaction_id: true, staff_id: true },
      });
      if (!transaction) {
        return NextResponse.json(
          { error: "Inventory transaction not found" },
          { status: 404, headers: corsHeaders },
        );
      }
      if (transaction.staff_id === session.staffId) {
        return NextResponse.json(
          { error: "You cannot acknowledge a transaction you created" },
          { status: 403, headers: corsHeaders },
        );
      }

      const acknowledgement = await prisma.inventoryTransactionAcknowledgement.create({
        data: {
          transaction_id: transaction.transaction_id,
          staff_id: session.staffId,
        },
        include: {
          staff: { select: { staff_name: true } },
        },
      });
      return NextResponse.json(acknowledgement, { status: 201, headers: corsHeaders });
    }

    const order = await prisma.salesOrder.findUnique({
      where: { order_id: recordId },
      select: { order_id: true, salesperson_id: true },
    });
    if (!order) {
      return NextResponse.json(
        { error: "Sales order not found" },
        { status: 404, headers: corsHeaders },
      );
    }
    if (order.salesperson_id === session.staffId) {
      return NextResponse.json(
        { error: "You cannot acknowledge a sale you created" },
        { status: 403, headers: corsHeaders },
      );
    }

    const acknowledgement = await prisma.salesOrderAcknowledgement.create({
      data: {
        order_id: order.order_id,
        staff_id: session.staffId,
      },
      include: {
        staff: { select: { staff_name: true } },
      },
    });
    return NextResponse.json(acknowledgement, { status: 201, headers: corsHeaders });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "You have already acknowledged this record" },
        { status: 409, headers: corsHeaders },
      );
    }
    console.error("Failed to acknowledge transaction record", error);
    return NextResponse.json(
      { error: "Failed to acknowledge transaction record" },
      { status: 500, headers: corsHeaders },
    );
  }
}
