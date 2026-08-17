import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { warehouse_id: "asc" },
    });

    return NextResponse.json(warehouses, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch warehouses" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { warehouse_name } = body;

    if (!warehouse_name) {
      return NextResponse.json(
        { error: "warehouse_name is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        warehouse_name: String(warehouse_name),
      },
    });

    return NextResponse.json(warehouse, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create warehouse" },
      { status: 500, headers: corsHeaders },
    );
  }
}
