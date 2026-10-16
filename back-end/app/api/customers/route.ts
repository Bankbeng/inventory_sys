import { NextResponse } from "next/server";

import { normalizeCustomerFields } from "@/lib/customer-fields";
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
    const customers = await prisma.customer.findMany({
      orderBy: [{ customer_name: "asc" }, { customer_id: "asc" }],
    });
    return NextResponse.json(customers, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch customer records" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customer = await prisma.customer.create({
      data: normalizeCustomerFields(body),
    });
    return NextResponse.json(customer, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create customer" },
      { status: 400, headers: corsHeaders },
    );
  }
}
