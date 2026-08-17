import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function parseIds(warehouseId: string, productId: string) {
  const wId = Number(warehouseId);
  const pId = Number(productId);

  if (!Number.isInteger(wId) || !Number.isInteger(pId)) {
    throw new Error("Invalid stock ids");
  }

  return { warehouse_id: wId, product_id: pId };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ warehouseId: string; productId: string }> },
) {
  try {
    const { warehouseId, productId } = await params;
    const ids = parseIds(warehouseId, productId);

    const stock = await prisma.warehouseStock.findUnique({
      where: {
        warehouse_id_product_id: ids,
      },
      include: {
        warehouse: true,
        product: true,
      },
    });

    if (!stock) {
      return NextResponse.json({ error: "Warehouse stock not found" }, { status: 404 });
    }

    return NextResponse.json(stock);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch warehouse stock" },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ warehouseId: string; productId: string }> },
) {
  try {
    const { warehouseId, productId } = await params;
    const ids = parseIds(warehouseId, productId);
    const body = await request.json();

    const stock = await prisma.warehouseStock.update({
      where: {
        warehouse_id_product_id: ids,
      },
      data: {
        ...(body.quantity !== undefined ? { quantity: Number(body.quantity) } : {}),
      },
    });

    return NextResponse.json(stock);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Warehouse stock not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update warehouse stock" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ warehouseId: string; productId: string }> },
) {
  try {
    const { warehouseId, productId } = await params;
    const ids = parseIds(warehouseId, productId);

    await prisma.warehouseStock.delete({
      where: {
        warehouse_id_product_id: ids,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Warehouse stock not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete warehouse stock" },
      { status: 400 },
    );
  }
}
