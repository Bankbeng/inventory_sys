import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const orders = await prisma.salesOrder.findMany({
      orderBy: { order_id: "asc" },
      include: {
        salesperson: true,
        sourceVehicle: true,
        sourceWarehouse: true,
        details: true,
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sales orders" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { salesperson_id, source_vehicle_id, source_warehouse_id, total_amount } = body;

    if (salesperson_id === undefined || total_amount === undefined) {
      return NextResponse.json(
        { error: "salesperson_id and total_amount are required" },
        { status: 400 },
      );
    }

    const order = await prisma.salesOrder.create({
      data: {
        salesperson_id: Number(salesperson_id),
        source_vehicle_id: source_vehicle_id === undefined ? null : Number(source_vehicle_id),
        source_warehouse_id: source_warehouse_id === undefined ? null : Number(source_warehouse_id),
        total_amount: Number(total_amount),
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create sales order" },
      { status: 500 },
    );
  }
}
