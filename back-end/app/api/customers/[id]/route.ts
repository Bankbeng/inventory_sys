import { NextResponse } from "next/server";

import { corsHeaders } from "@/lib/cors";
import { normalizeCustomerFields } from "@/lib/customer-fields";
import { prisma } from "@/lib/prisma";

function parseId(id: string) {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid customer id");
  }
  return parsed;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const customer = await prisma.customer.update({
      where: { customer_id: parseId(id) },
      data: normalizeCustomerFields(body),
    });
    return NextResponse.json(customer, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update customer" },
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
    await prisma.customer.delete({
      where: { customer_id: parseId(id) },
    });
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete customer" },
      { status: 400, headers: corsHeaders },
    );
  }
}
