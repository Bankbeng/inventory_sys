import { NextResponse } from "next/server";

import { corsHeaders } from "@/lib/cors";
import { normalizeCustomerFields } from "@/lib/customer-fields";
import { prisma } from "@/lib/prisma";

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
