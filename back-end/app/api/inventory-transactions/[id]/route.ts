import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function parseId(id: string) {
  const parsed = Number(id);

  if (!Number.isInteger(parsed)) {
    throw new Error("Invalid transaction id");
  }

  return parsed;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { transaction_id: parseId(id) },
      include: {
        staff: true,
        fromWarehouse: true,
        toWarehouse: true,
        fromVehicle: true,
        toVehicle: true,
        details: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Inventory transaction not found" }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch inventory transaction" },
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

    const transaction = await prisma.inventoryTransaction.update({
      where: { transaction_id: parseId(id) },
      data: {
        ...(body.transaction_type !== undefined ? { transaction_type: String(body.transaction_type) } : {}),
        ...(body.staff_id !== undefined ? { staff_id: Number(body.staff_id) } : {}),
        ...(body.from_warehouse_id !== undefined ? { from_warehouse_id: Number(body.from_warehouse_id) } : {}),
        ...(body.to_warehouse_id !== undefined ? { to_warehouse_id: Number(body.to_warehouse_id) } : {}),
        ...(body.from_vehicle_id !== undefined ? { from_vehicle_id: Number(body.from_vehicle_id) } : {}),
        ...(body.to_vehicle_id !== undefined ? { to_vehicle_id: Number(body.to_vehicle_id) } : {}),
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Inventory transaction not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update inventory transaction" },
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
    await prisma.inventoryTransaction.delete({
      where: { transaction_id: parseId(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Inventory transaction not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete inventory transaction" },
      { status: 400 },
    );
  }
}
