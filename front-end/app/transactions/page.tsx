"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime as formatDateTimeValue } from "@/lib/date";

type TransactionDetail = {
  transaction_id: number;
  product_id: number;
  quantity: number;
};

type Acknowledgement = {
  staff_id: number;
  acknowledged_at: string;
  staff: { staff_name: string };
};

type Transaction = {
  transaction_id: number;
  transaction_type: string;
  date_time: string;
  staff_id: number;
  from_warehouse_id: number | null;
  to_warehouse_id: number | null;
  from_vehicle_id: number | null;
  to_vehicle_id: number | null;
  staff?: { staff_name: string };
  fromWarehouse?: { warehouse_name: string };
  toWarehouse?: { warehouse_name: string };
  fromVehicle?: { vehicle_name: string };
  toVehicle?: { vehicle_name: string };
  details?: TransactionDetail[];
  acknowledgements?: Acknowledgement[];
};

type SalesOrder = {
  order_id: number;
  customer_name: string;
  order_date: string;
  total_amount: number;
  salesperson?: { staff_name: string };
  sourceWarehouse?: { warehouse_name: string } | null;
  sourceVehicle?: { vehicle_name: string } | null;
  salesperson_id: number;
  acknowledgements?: Acknowledgement[];
  details?: {
    product_id: number;
    quantity_sold: number;
    sold_at_price: number;
  }[];
};

type HistoryEntry =
  | { type: "inventory"; date: string; transaction: Transaction }
  | { type: "SALE"; date: string; order: SalesOrder };

type Product = {
  product_id: number;
  product_name: string;
  type: string;
  size: string;
  unit: string;
};

function getAcknowledgementError(message: unknown) {
  switch (message) {
    case "Authentication required":
      return "ກະລຸນາເຂົ້າລະບົບກ່ອນ.";
    case "Inventory transaction not found":
    case "Sales order not found":
      return "ບໍ່ພົບລາຍການນີ້.";
    case "You cannot acknowledge a transaction you created":
    case "You cannot acknowledge a sale you created":
      return "ທ່ານບໍ່ສາມາດຮັບຊາບລາຍການທີ່ທ່ານສ້າງເອງໄດ້.";
    case "You have already acknowledged this record":
      return "ທ່ານໄດ້ຮັບຊາບລາຍການນີ້ແລ້ວ.";
    default:
      return "ບໍ່ສາມາດຮັບຊາບລາຍການໄດ້. ກະລຸນາລອງໃໝ່.";
  }
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAcknowledgement, setPendingAcknowledgement] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [transactionResponse, salesResponse, productResponse, staffResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/inventory-transactions`),
        fetch(`${API_BASE_URL}/api/sales-orders`),
        fetch(`${API_BASE_URL}/api/products`),
        fetch("/api/access-check?all=true"),
      ]);

      const [transactionData, salesData, productData, staffData] = await Promise.all([
        transactionResponse.json(),
        salesResponse.json(),
        productResponse.json(),
        staffResponse.json(),
      ]);

      for (const [response, label] of [
        [transactionResponse, "ລາຍການເຄື່ອນໄຫວສາງ"],
        [salesResponse, "ລາຍການຂາຍ"],
        [productResponse, "ຂໍ້ມູນສິນຄ້າ"],
        [staffResponse, "ຂໍ້ມູນຜູ້ໃຊ້"],
      ] as const) {
        if (!response.ok) {
          throw new Error(`ບໍ່ສາມາດໂຫຼດ${label}ໄດ້.`);
        }
      }

      if (
        !Array.isArray(transactionData) ||
        !Array.isArray(salesData) ||
        !Array.isArray(productData) ||
        !Number.isInteger(staffData.staff_id)
      ) {
        throw new Error("ຂໍ້ມູນປະຫວັດລາຍການເຄື່ອນໄຫວບໍ່ຖືກຕ້ອງ.");
      }

      setTransactions(transactionData);
      setSalesOrders(salesData);
      setProducts(productData);
      setCurrentStaffId(staffData.staff_id);
      setErrorMessage(null);
    } catch (error) {
      console.error("Failed to load data", error);
      setErrorMessage(error instanceof Error ? error.message : "ບໍ່ສາມາດໂຫຼດປະຫວັດລາຍການໄດ້.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  async function acknowledgeRecord(recordType: "inventory" | "sale", recordId: number) {
    const key = `${recordType}-${recordId}`;
    setPendingAcknowledgement(key);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/acknowledgements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_type: recordType, record_id: recordId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(getAcknowledgementError(data.error));
      }

      if (recordType === "inventory") {
        setTransactions((current) =>
          current.map((transaction) =>
            transaction.transaction_id === recordId
              ? { ...transaction, acknowledgements: [...(transaction.acknowledgements ?? []), data] }
              : transaction,
          ),
        );
      } else {
        setSalesOrders((current) =>
          current.map((order) =>
            order.order_id === recordId
              ? { ...order, acknowledgements: [...(order.acknowledgements ?? []), data] }
              : order,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to acknowledge transaction record", error);
      setErrorMessage(error instanceof Error ? error.message : "ບໍ່ສາມາດຮັບຊາບລາຍການໄດ້.");
    } finally {
      setPendingAcknowledgement(null);
    }
  }

  const history: HistoryEntry[] = [
    ...transactions.map((transaction) => ({
      type: "inventory" as const,
      date: transaction.date_time,
      transaction,
    })),
    ...salesOrders.map((order) => ({
      type: "SALE" as const,
      date: order.order_date,
      order,
    })),
  ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  const filteredTransactions = history.filter((entry) => {
    if (filterType === "all") return true;
    if (filterType === "SALE") return entry.type === "SALE";
    return entry.type === "inventory" && entry.transaction.transaction_type === filterType;
  });

  const getProductName = (productId: number): string => {
    const product = products.find((p) => p.product_id === productId);
    if (!product) return `ສິນຄ້າ ${productId}`;
    const attributes = [product.type, [product.size, product.unit].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    return attributes ? `${product.product_name} (${attributes})` : product.product_name;
  };

  const getTransactionDescription = (transaction: Transaction): string => {
    const staffName = transaction.staff?.staff_name ?? `ພະນັກງານ ${transaction.staff_id}`;
    const details = transaction.details?.[0];
    const quantity = details?.quantity ?? 0;
    const productName = details ? getProductName(details.product_id) : "ບໍ່ຮູ້ຈັກສິນຄ້າ";

    switch (transaction.transaction_type) {
      case "INBOUND":
        if (transaction.toWarehouse) {
          return `${staffName} ຮັບສິນຄ້າ ${productName} ຈຳນວນ ${quantity} ເຂົ້າສາງ ${transaction.toWarehouse.warehouse_name}`;
        }
        if (transaction.toVehicle) {
          return `${staffName} ຮັບສິນຄ້າ ${productName} ຈຳນວນ ${quantity} ເຂົ້າລົດ ${transaction.toVehicle.vehicle_name}`;
        }
        return `${staffName} ຮັບສິນຄ້າ ${productName} ຈຳນວນ ${quantity}`;

      case "OUTBOUND":
        if (transaction.fromWarehouse) {
          return `${staffName} ນຳສິນຄ້າ ${productName} ຈຳນວນ ${quantity} ອອກຈາກສາງ ${transaction.fromWarehouse.warehouse_name}`;
        }
        if (transaction.fromVehicle) {
          return `${staffName} ນຳສິນຄ້າ ${productName} ຈຳນວນ ${quantity} ອອກຈາກລົດ ${transaction.fromVehicle.vehicle_name}`;
        }
        return `${staffName} ນຳສິນຄ້າ ${productName} ຈຳນວນ ${quantity} ອອກ`;

      case "TRANSFER":
        let source = "";
        let destination = "";

        if (transaction.fromWarehouse) {
          source = `ສາງ ${transaction.fromWarehouse.warehouse_name}`;
        } else if (transaction.fromVehicle) {
          source = `ລົດ ${transaction.fromVehicle.vehicle_name}`;
        }

        if (transaction.toWarehouse) {
          destination = `ສາງ ${transaction.toWarehouse.warehouse_name}`;
        } else if (transaction.toVehicle) {
          destination = `ລົດ ${transaction.toVehicle.vehicle_name}`;
        }

        return `${staffName} ໂອນສິນຄ້າ ${productName} ຈຳນວນ ${quantity} ຈາກ${source} ໄປ${destination}`;

      default:
        return `${staffName} ເຄື່ອນຍ້າຍສິນຄ້າ ${productName} ຈຳນວນ ${quantity}`;
    }
  };

  const getSaleDescription = (order: SalesOrder): string => {
    const salesperson = order.salesperson?.staff_name ?? "ບໍ່ຮູ້ຈັກຜູ້ຂາຍ";
    const source = order.sourceWarehouse?.warehouse_name ?? order.sourceVehicle?.vehicle_name;
    return `${salesperson} ບັນທຶກການຂາຍ SO-${order.order_id} ໃຫ້ລູກຄ້າ ${order.customer_name}${source ? ` ຈາກ${source}` : ""}`;
  };

  const formatDateTime = (dateString: string): string => {
    return formatDateTimeValue(dateString, true);
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "INBOUND":
        return "ຮັບສິນຄ້າເຂົ້າ";
      case "OUTBOUND":
        return "ນຳສິນຄ້າອອກ";
      case "TRANSFER":
        return "ໂອນສິນຄ້າ";
      case "SALE":
        return "ຂາຍ";
      default:
        return "ອື່ນໆ";
    }
  };

  const getTransactionBadgeColor = (type: string): string => {
    switch (type) {
      case "INBOUND":
        return "bg-emerald-800 text-white";
      case "OUTBOUND":
        return "bg-amber-800 text-white";
      case "TRANSFER":
        return "bg-blue-800 text-white";
      case "SALE":
        return "bg-cyan-800 text-white";
      default:
        return "bg-slate-800 text-white";
    }
  };

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">ສາງສິນຄ້າ</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">ປະຫວັດລາຍການເຄື່ອນໄຫວ</h1>
        </div>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <h2 className="text-xl font-semibold">ລາຍການເຄື່ອນໄຫວ</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-500">ກັ່ນຕອງ:</span>
              <select
                value={filterType}
                onChange={(event) => setFilterType(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-400"
              >
                <option value="all">ທຸກລາຍການ</option>
                <option value="INBOUND">ຮັບສິນຄ້າເຂົ້າ</option>
                <option value="OUTBOUND">ນຳສິນຄ້າອອກ</option>
                <option value="TRANSFER">ໂອນສິນຄ້າ</option>
                <option value="SALE">ການຂາຍ</option>
              </select>
              <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-700">
                {filteredTransactions.length} ລາຍການ
              </span>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-600 text-center">
              ກຳລັງໂຫຼດປະຫວັດລາຍການ...
            </div>
          ) : errorMessage ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
              {errorMessage}
            </div>
          ) : filteredTransactions.length > 0 ? (
            <div className="space-y-3">
              {filteredTransactions.map((entry) => (
                <div
                  key={entry.type === "SALE" ? `sale-${entry.order.order_id}` : `inventory-${entry.transaction.transaction_id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getTransactionBadgeColor(entry.type === "SALE" ? "SALE" : entry.transaction.transaction_type)}`}>
                          {getTransactionTypeLabel(entry.type === "SALE" ? "SALE" : entry.transaction.transaction_type)}
                        </span>
                        <span className="text-sm text-slate-500">
                          {entry.type === "SALE" ? `ໃບຂາຍ #${entry.order.order_id}` : `ລາຍການ #${entry.transaction.transaction_id}`}
                        </span>
                      </div>
                      <p className="text-slate-700 text-sm">
                        {entry.type === "SALE" ? getSaleDescription(entry.order) : getTransactionDescription(entry.transaction)}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      {formatDateTime(entry.date)}
                    </div>
                  </div>

                  {entry.type === "SALE" ? (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <div className="space-y-2 text-xs">
                        {(entry.order.details ?? []).map((detail) => (
                          <div key={`${entry.order.order_id}-${detail.product_id}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                            <span className="font-medium text-cyan-700">{getProductName(detail.product_id)}</span>
                            <span className="text-slate-600">
                              {detail.quantity_sold} ໜ່ວຍ × {formatCurrency(Number(detail.sold_at_price))} = {formatCurrency(Number(detail.quantity_sold) * Number(detail.sold_at_price))}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-end border-t border-slate-200 pt-2 font-semibold text-slate-800">
                          ລວມທັງໝົດ: {formatCurrency(Number(entry.order.total_amount))}
                        </div>
                      </div>
                    </div>
                  ) : entry.transaction.details && entry.transaction.details.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {entry.transaction.details.map((detail, idx) => (
                          <div key={idx} className="space-y-1">
                            <p className="text-slate-500">ສິນຄ້າ</p>
                            <p className="text-cyan-700 font-medium">
                              {getProductName(detail.product_id)}
                            </p>
                            <p className="text-slate-500 mt-2">ຈຳນວນ</p>
                            <p className="text-emerald-700 font-medium">{detail.quantity} ໜ່ວຍ</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {(() => {
                    const recordType = entry.type === "SALE" ? "sale" : "inventory";
                    const recordId = entry.type === "SALE"
                      ? entry.order.order_id
                      : entry.transaction.transaction_id;
                    const creatorId = entry.type === "SALE"
                      ? entry.order.salesperson_id
                      : entry.transaction.staff_id;
                    const acknowledgements = entry.type === "SALE"
                      ? entry.order.acknowledgements ?? []
                      : entry.transaction.acknowledgements ?? [];
                    const isCreator = currentStaffId !== null && creatorId === currentStaffId;
                    const hasAcknowledged = currentStaffId !== null && acknowledgements.some(
                      (acknowledgement) => acknowledgement.staff_id === currentStaffId,
                    );

                    return (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                        <div className="text-xs text-slate-600">
                          {acknowledgements.length > 0 ? (
                            <span>
                              ຮັບຊາບໂດຍ:{" "}
                              {acknowledgements.map((acknowledgement, index) => (
                                <span key={acknowledgement.staff_id}>
                                  {index > 0 ? ", " : ""}
                                  {acknowledgement.staff.staff_name} ({formatDateTime(acknowledgement.acknowledged_at)})
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="font-medium text-rose-600">ຍັງບໍ່ມີຜູ້ຮັບຊາບ</span>
                          )}
                        </div>
                        {!isCreator && (
                          <button
                            type="button"
                            onClick={() => void acknowledgeRecord(recordType, recordId)}
                            disabled={hasAcknowledged || pendingAcknowledgement !== null}
                            className="rounded-lg border border-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingAcknowledgement === `${recordType}-${recordId}`
                              ? "ກຳລັງຮັບຊາບ..."
                              : hasAcknowledged
                                ? "ຮັບຊາບແລ້ວ"
                                : "ຮັບຊາບ"}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-500 text-center">
              ບໍ່ພົບລາຍການ.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
