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
    throw new Error("Invalid product id");
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
    const product = await prisma.product.findUnique({
      where: { product_id: parseId(id) },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(product, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch product" },
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

    const product = await prisma.product.update({
      where: { product_id: parseId(id) },
      data: {
        ...(body.product_name !== undefined ? { product_name: String(body.product_name) } : {}),
        ...(body.category !== undefined ? { category: String(body.category) } : {}),
        ...(body.cost_price !== undefined ? { cost_price: Number(body.cost_price) } : {}),
        ...(body.retail_price !== undefined ? { retail_price: Number(body.retail_price) } : {}),
      },
    });

    return NextResponse.json(product, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Product not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update product" },
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
    await prisma.product.delete({
      where: { product_id: parseId(id) },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Product not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete product" },
      { status: 400, headers: corsHeaders },
    );
  }
}
