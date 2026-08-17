import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

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
  try {
    const { id } = await params;
    const body = await request.json();

    const order = await prisma.salesOrder.update({
      where: { order_id: parseId(id) },
      data: {
        ...(body.salesperson_id !== undefined ? { salesperson_id: Number(body.salesperson_id) } : {}),
        ...(body.source_vehicle_id !== undefined ? { source_vehicle_id: Number(body.source_vehicle_id) } : {}),
        ...(body.source_warehouse_id !== undefined ? { source_warehouse_id: Number(body.source_warehouse_id) } : {}),
        ...(body.total_amount !== undefined ? { total_amount: Number(body.total_amount) } : {}),
      },
    });

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
    await prisma.salesOrder.delete({
      where: { order_id: parseId(id) },
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
