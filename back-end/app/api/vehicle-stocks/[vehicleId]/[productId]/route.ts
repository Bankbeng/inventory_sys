import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function parseIds(vehicleId: string, productId: string) {
  const vId = Number(vehicleId);
  const pId = Number(productId);

  if (!Number.isInteger(vId) || !Number.isInteger(pId)) {
    throw new Error("Invalid stock ids");
  }

  return { vehicle_id: vId, product_id: pId };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vehicleId: string; productId: string }> },
) {
  try {
    const { vehicleId, productId } = await params;
    const ids = parseIds(vehicleId, productId);

    const stock = await prisma.vehicleStock.findUnique({
      where: {
        vehicle_id_product_id: ids,
      },
      include: {
        vehicle: true,
        product: true,
      },
    });

    if (!stock) {
      return NextResponse.json({ error: "Vehicle stock not found" }, { status: 404 });
    }

    return NextResponse.json(stock);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch vehicle stock" },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vehicleId: string; productId: string }> },
) {
  try {
    const { vehicleId, productId } = await params;
    const ids = parseIds(vehicleId, productId);
    const body = await request.json();

    const stock = await prisma.vehicleStock.update({
      where: {
        vehicle_id_product_id: ids,
      },
      data: {
        ...(body.quantity !== undefined ? { quantity: Number(body.quantity) } : {}),
      },
    });

    return NextResponse.json(stock);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Vehicle stock not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update vehicle stock" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ vehicleId: string; productId: string }> },
) {
  try {
    const { vehicleId, productId } = await params;
    const ids = parseIds(vehicleId, productId);

    await prisma.vehicleStock.delete({
      where: {
        vehicle_id_product_id: ids,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Vehicle stock not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete vehicle stock" },
      { status: 400 },
    );
  }
}
