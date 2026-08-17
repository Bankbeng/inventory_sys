import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const stocks = await prisma.warehouseStock.findMany({
      orderBy: [{ warehouse_id: "asc" }, { product_id: "asc" }],
      include: {
        warehouse: true,
        product: true,
      },
    });

    return NextResponse.json(stocks);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch warehouse stock" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { warehouse_id, product_id, quantity } = body;

    if (warehouse_id === undefined || product_id === undefined || quantity === undefined) {
      return NextResponse.json(
        { error: "warehouse_id, product_id and quantity are required" },
        { status: 400 },
      );
    }

    const stock = await prisma.warehouseStock.create({
      data: {
        warehouse_id: Number(warehouse_id),
        product_id: Number(product_id),
        quantity: Number(quantity),
      },
    });

    return NextResponse.json(stock, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create warehouse stock record" },
      { status: 500 },
    );
  }
}
