import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const stocks = await prisma.vehicleStock.findMany({
      orderBy: [{ vehicle_id: "asc" }, { product_id: "asc" }],
      include: {
        vehicle: true,
        product: true,
      },
    });

    return NextResponse.json(stocks);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch vehicle stock" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vehicle_id, product_id, quantity } = body;

    if (vehicle_id === undefined || product_id === undefined || quantity === undefined) {
      return NextResponse.json(
        { error: "vehicle_id, product_id and quantity are required" },
        { status: 400 },
      );
    }

    const stock = await prisma.vehicleStock.create({
      data: {
        vehicle_id: Number(vehicle_id),
        product_id: Number(product_id),
        quantity: Number(quantity),
      },
    });

    return NextResponse.json(stock, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create vehicle stock record" },
      { status: 500 },
    );
  }
}
