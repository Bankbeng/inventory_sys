"use client";

import { useEffect, useState } from "react";

type TransactionDetail = {
  transaction_id: number;
  product_id: number;
  quantity: number;
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
};

type Product = {
  product_id: number;
  product_name: string;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  async function loadData() {
    try {
      const [transactionResponse, productResponse] = await Promise.all([
        fetch("http://localhost:3000/api/inventory-transactions"),
        fetch("http://localhost:3000/api/products"),
      ]);

      const [transactionData, productData] = await Promise.all([
        transactionResponse.json(),
        productResponse.json(),
      ]);

      setTransactions(Array.isArray(transactionData) ? transactionData : []);
      setProducts(Array.isArray(productData) ? productData : []);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredTransactions =
    filterType === "all"
      ? transactions
      : transactions.filter((t) => t.transaction_type === filterType);

  const getProductName = (productId: number): string => {
    return products.find((p) => p.product_id === productId)?.product_name ?? `Product ${productId}`;
  };

  const getTransactionDescription = (transaction: Transaction): string => {
    const staffName = transaction.staff?.staff_name ?? `Staff ${transaction.staff_id}`;
    const details = transaction.details?.[0];
    const quantity = details?.quantity ?? 0;
    const productName = details ? getProductName(details.product_id) : "Unknown product";

    switch (transaction.transaction_type) {
      case "INBOUND":
        if (transaction.toWarehouse) {
          return `${staffName} received ${quantity} ${productName} to ${transaction.toWarehouse.warehouse_name}`;
        }
        if (transaction.toVehicle) {
          return `${staffName} received ${quantity} ${productName} to ${transaction.toVehicle.vehicle_name}`;
        }
        return `${staffName} received ${quantity} ${productName}`;

      case "OUTBOUND":
        if (transaction.fromWarehouse) {
          return `${staffName} shipped ${quantity} ${productName} from ${transaction.fromWarehouse.warehouse_name}`;
        }
        if (transaction.fromVehicle) {
          return `${staffName} shipped ${quantity} ${productName} from ${transaction.fromVehicle.vehicle_name}`;
        }
        return `${staffName} shipped ${quantity} ${productName}`;

      case "TRANSFER":
        let source = "";
        let destination = "";

        if (transaction.fromWarehouse) {
          source = `warehouse ${transaction.fromWarehouse.warehouse_name}`;
        } else if (transaction.fromVehicle) {
          source = `vehicle ${transaction.fromVehicle.vehicle_name}`;
        }

        if (transaction.toWarehouse) {
          destination = `warehouse ${transaction.toWarehouse.warehouse_name}`;
        } else if (transaction.toVehicle) {
          destination = `vehicle ${transaction.toVehicle.vehicle_name}`;
        }

        return `${staffName} transferred ${quantity} ${productName} from ${source} to ${destination}`;

      default:
        return `${staffName} moved ${quantity} ${productName}`;
    }
  };

  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getTransactionBadgeColor = (type: string): string => {
    switch (type) {
      case "INBOUND":
        return "bg-emerald-500/10 text-emerald-300";
      case "OUTBOUND":
        return "bg-amber-500/10 text-amber-300";
      case "TRANSFER":
        return "bg-blue-500/10 text-blue-300";
      default:
        return "bg-slate-500/10 text-slate-300";
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Inventory</p>
          <h1 className="mt-2 text-3xl font-bold">Transaction history</h1>
        </div>

        <section className="mb-8 rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <h2 className="text-xl font-semibold">Transactions</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-400">Filter:</span>
              <select
                value={filterType}
                onChange={(event) => setFilterType(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="all">All transactions</option>
                <option value="INBOUND">Stock in (Inbound)</option>
                <option value="OUTBOUND">Stock out (Outbound)</option>
                <option value="TRANSFER">Transfers</option>
              </select>
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                {filteredTransactions.length} records
              </span>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-white/10 bg-slate-950 p-6 text-slate-300 text-center">
              Loading transaction history...
            </div>
          ) : filteredTransactions.length > 0 ? (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.transaction_id}
                  className="rounded-xl border border-white/10 bg-slate-950/50 p-4 hover:border-white/20 transition"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getTransactionBadgeColor(transaction.transaction_type)}`}>
                          {transaction.transaction_type}
                        </span>
                        <span className="text-sm text-slate-400">
                          Transaction #{transaction.transaction_id}
                        </span>
                      </div>
                      <p className="text-slate-200 text-sm">
                        {getTransactionDescription(transaction)}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-400">
                      {formatDateTime(transaction.date_time)}
                    </div>
                  </div>

                  {transaction.details && transaction.details.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {transaction.details.map((detail, idx) => (
                          <div key={idx} className="space-y-1">
                            <p className="text-slate-400">Product</p>
                            <p className="text-cyan-300 font-medium">
                              {getProductName(detail.product_id)}
                            </p>
                            <p className="text-slate-400 mt-2">Quantity</p>
                            <p className="text-emerald-300 font-medium">{detail.quantity} units</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-slate-950 p-6 text-slate-400 text-center">
              No transactions found.
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total transactions</p>
            <p className="mt-4 text-3xl font-bold text-cyan-300">{transactions.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Stock movements (in + out)</p>
            <p className="mt-4 text-3xl font-bold text-emerald-300">
              {transactions.filter((t) => t.transaction_type === "INBOUND" || t.transaction_type === "OUTBOUND").length}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Transfers</p>
            <p className="mt-4 text-3xl font-bold text-blue-300">
              {transactions.filter((t) => t.transaction_type === "TRANSFER").length}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
