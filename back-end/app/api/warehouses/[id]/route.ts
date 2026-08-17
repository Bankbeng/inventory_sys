import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function parseId(id: string) {
  const parsed = Number(id);

  if (!Number.isInteger(parsed)) {
    throw new Error("Invalid warehouse id");
  }

  return parsed;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const warehouse = await prisma.warehouse.findUnique({
      where: { warehouse_id: parseId(id) },
    });

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(warehouse, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch warehouse" },
      { status: 400, headers: corsHeaders },
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

    const warehouse = await prisma.warehouse.update({
      where: { warehouse_id: parseId(id) },
      data: {
        ...(body.warehouse_name !== undefined ? { warehouse_name: String(body.warehouse_name) } : {}),
      },
    });

    return NextResponse.json(warehouse, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update warehouse" },
      { status: 400, headers: corsHeaders },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.warehouse.delete({
      where: { warehouse_id: parseId(id) },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete warehouse" },
      { status: 400, headers: corsHeaders },
    );
  }
}
