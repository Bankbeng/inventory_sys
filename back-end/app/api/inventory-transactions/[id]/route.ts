import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentStaff, isAdminRole } from "@/lib/permissions";
import { getSessionFromRequest } from "@/lib/session";

class InventoryTransactionNotFoundError extends Error {}

class InventoryReversalError extends Error {}

async function addWarehouseStock(
  tx: Prisma.TransactionClient,
  warehouseId: number,
  productId: number,
  quantity: number,
) {
  await tx.warehouseStock.upsert({
    where: { warehouse_id_product_id: { warehouse_id: warehouseId, product_id: productId } },
    create: { warehouse_id: warehouseId, product_id: productId, quantity },
    update: { quantity: { increment: quantity } },
  });
}

async function addVehicleStock(
  tx: Prisma.TransactionClient,
  vehicleId: number,
  productId: number,
  quantity: number,
) {
  await tx.vehicleStock.upsert({
    where: { vehicle_id_product_id: { vehicle_id: vehicleId, product_id: productId } },
    create: { vehicle_id: vehicleId, product_id: productId, quantity },
    update: { quantity: { increment: quantity } },
  });
}

async function removeWarehouseStock(
  tx: Prisma.TransactionClient,
  warehouseId: number,
  productId: number,
  quantity: number,
) {
  const result = await tx.warehouseStock.updateMany({
    where: {
      warehouse_id: warehouseId,
      product_id: productId,
      quantity: { gte: quantity },
    },
    data: { quantity: { decrement: quantity } },
  });
  if (result.count === 0) {
    throw new InventoryReversalError("Insufficient warehouse stock to reverse this transaction");
  }
}

async function removeVehicleStock(
  tx: Prisma.TransactionClient,
  vehicleId: number,
  productId: number,
  quantity: number,
) {
  const result = await tx.vehicleStock.updateMany({
    where: {
      vehicle_id: vehicleId,
      product_id: productId,
      quantity: { gte: quantity },
    },
    data: { quantity: { decrement: quantity } },
  });
  if (result.count === 0) {
    throw new InventoryReversalError("Insufficient vehicle stock to reverse this transaction");
  }
}

async function reverseTransactionStock(
  tx: Prisma.TransactionClient,
  transaction: {
    transaction_type: string;
    from_warehouse_id: number | null;
    to_warehouse_id: number | null;
    from_vehicle_id: number | null;
    to_vehicle_id: number | null;
    details: { product_id: number; quantity: number }[];
  },
) {
  for (const detail of transaction.details) {
    if (!Number.isInteger(detail.quantity) || detail.quantity <= 0) {
      throw new InventoryReversalError("Transaction has an invalid product quantity");
    }

    switch (transaction.transaction_type) {
      case "INBOUND":
        if (transaction.to_warehouse_id !== null) {
          await removeWarehouseStock(tx, transaction.to_warehouse_id, detail.product_id, detail.quantity);
        } else if (transaction.to_vehicle_id !== null) {
          await removeVehicleStock(tx, transaction.to_vehicle_id, detail.product_id, detail.quantity);
        } else {
          throw new InventoryReversalError("Transaction has no destination to reverse");
        }
        break;
      case "OUTBOUND":
        if (transaction.from_warehouse_id !== null) {
          await addWarehouseStock(tx, transaction.from_warehouse_id, detail.product_id, detail.quantity);
        } else if (transaction.from_vehicle_id !== null) {
          await addVehicleStock(tx, transaction.from_vehicle_id, detail.product_id, detail.quantity);
        } else {
          throw new InventoryReversalError("Transaction has no source to reverse");
        }
        break;
      case "TRANSFER":
        if (transaction.to_warehouse_id !== null) {
          await removeWarehouseStock(tx, transaction.to_warehouse_id, detail.product_id, detail.quantity);
        } else if (transaction.to_vehicle_id !== null) {
          await removeVehicleStock(tx, transaction.to_vehicle_id, detail.product_id, detail.quantity);
        } else {
          throw new InventoryReversalError("Transaction has no destination to reverse");
        }

        if (transaction.from_warehouse_id !== null) {
          await addWarehouseStock(tx, transaction.from_warehouse_id, detail.product_id, detail.quantity);
        } else if (transaction.from_vehicle_id !== null) {
          await addVehicleStock(tx, transaction.from_vehicle_id, detail.product_id, detail.quantity);
        } else {
          throw new InventoryReversalError("Transaction has no source to reverse");
        }
        break;
      default:
        throw new InventoryReversalError("Unsupported inventory transaction type");
    }
  }
}

function parseId(id: string) {
  const parsed = Number(id);

  if (!Number.isInteger(parsed)) {
    throw new Error("Invalid transaction id");
  }

  return parsed;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { transaction_id: parseId(id) },
      include: {
        staff: {
          select: { staff_id: true, staff_name: true },
        },
        fromWarehouse: true,
        toWarehouse: true,
        fromVehicle: true,
        toVehicle: true,
        details: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Inventory transaction not found" }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch inventory transaction" },
      { status: 400 },
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

    const transaction = await prisma.inventoryTransaction.update({
      where: { transaction_id: parseId(id) },
      data: {
        ...(body.transaction_type !== undefined ? { transaction_type: String(body.transaction_type) } : {}),
        ...(body.staff_id !== undefined ? { staff_id: Number(body.staff_id) } : {}),
        ...(body.from_warehouse_id !== undefined ? { from_warehouse_id: Number(body.from_warehouse_id) } : {}),
        ...(body.to_warehouse_id !== undefined ? { to_warehouse_id: Number(body.to_warehouse_id) } : {}),
        ...(body.from_vehicle_id !== undefined ? { from_vehicle_id: Number(body.from_vehicle_id) } : {}),
        ...(body.to_vehicle_id !== undefined ? { to_vehicle_id: Number(body.to_vehicle_id) } : {}),
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Inventory transaction not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update inventory transaction" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const staff = await getCurrentStaff(session.staffId);
    if (!staff) {
      return NextResponse.json({ error: "Staff account not found" }, { status: 401 });
    }
    if (!isAdminRole(staff.role)) {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }

    const { id } = await params;
    const transactionId = parseId(id);

    await prisma.$transaction(async (tx) => {
      const transaction = await tx.inventoryTransaction.findUnique({
        where: { transaction_id: transactionId },
        include: { details: true },
      });
      if (!transaction) {
        throw new InventoryTransactionNotFoundError("Inventory transaction not found");
      }

      await reverseTransactionStock(tx, transaction);
      await tx.inventoryTransactionAcknowledgement.deleteMany({
        where: { transaction_id: transactionId },
      });
      await tx.transactionDetail.deleteMany({
        where: { transaction_id: transactionId },
      });
      await tx.inventoryTransaction.delete({
        where: { transaction_id: transactionId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InventoryTransactionNotFoundError) {
      return NextResponse.json({ error: "Inventory transaction not found" }, { status: 404 });
    }
    if (error instanceof InventoryReversalError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Failed to delete inventory transaction", error);
    return NextResponse.json({ error: "Failed to delete inventory transaction" }, { status: 500 });
  }
}
