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
    throw new Error("Invalid vehicle id");
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
    const vehicle = await prisma.vehicle.findUnique({
      where: { vehicle_id: parseId(id) },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(vehicle, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch vehicle" },
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

    const vehicle = await prisma.vehicle.update({
      where: { vehicle_id: parseId(id) },
      data: {
        ...(body.vehicle_name !== undefined ? { vehicle_name: String(body.vehicle_name) } : {}),
      },
    });

    return NextResponse.json(vehicle, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update vehicle" },
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
    await prisma.vehicle.delete({
      where: { vehicle_id: parseId(id) },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete vehicle" },
      { status: 400, headers: corsHeaders },
    );
  }
}
