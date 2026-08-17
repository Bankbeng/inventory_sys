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
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { vehicle_id: "asc" },
    });

    return NextResponse.json(vehicles, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vehicle_name } = body;

    if (!vehicle_name) {
      return NextResponse.json(
        { error: "vehicle_name is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        vehicle_name: String(vehicle_name),
      },
    });

    return NextResponse.json(vehicle, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create vehicle" },
      { status: 500, headers: corsHeaders },
    );
  }
}
