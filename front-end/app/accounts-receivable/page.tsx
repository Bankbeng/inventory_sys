"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";

type Receivable = {
  order_id: number;
  customer_name: string;
  total_amount: number;
  order_date: string;
  is_paid: boolean;
  salesperson?: { staff_name: string };
  payments: {
    payment_id: number;
    amount: number;
    paid_at: string;
    note: string | null;
  }[];
};

function getOutstanding(order: Receivable) {
  const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return Math.max(0, order.total_amount - paid);
}

function getDebtDays(order: Receivable) {
  const orderDate = new Date(order.order_date);
  const settled = getOutstanding(order) <= 0.000001;
  const finalPaymentDate = settled && order.payments.length > 0
    ? new Date(order.payments[order.payments.length - 1].paid_at)
    : new Date();

  const startDay = Date.UTC(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
  const endDay = Date.UTC(finalPaymentDate.getFullYear(), finalPaymentDate.getMonth(), finalPaymentDate.getDate());
  return Math.max(0, Math.floor((endDay - startDay) / 86_400_000));
}

export default function AccountsReceivablePage() {
  const [orders, setOrders] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<number, string>>({});
  const [paymentNotes, setPaymentNotes] = useState<Record<number, string>>({});
  const [showSettledOrders, setShowSettledOrders] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadReceivables() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/sales-orders`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load receivables.");
        }

        if (!Array.isArray(data)) {
          throw new Error("Unexpected response while loading receivables.");
        }

        setOrders(data);
        setMessage(null);
      } catch (error) {
        console.error("Failed to load receivables", error);
        setMessage(error instanceof Error ? error.message : "Failed to load receivables.");
      } finally {
        setLoading(false);
      }
    }

    void loadReceivables();
  }, []);

  const outstandingTotal = useMemo(
    () => orders.reduce((sum, order) => sum + getOutstanding(order), 0),
    [orders],
  );
  const outstandingCount = orders.filter((order) => getOutstanding(order) > 0.000001).length;
  const visibleOrders = showSettledOrders
    ? orders
    : orders.filter((order) => getOutstanding(order) > 0.000001);

  async function recordPayment(orderId: number) {
    const amount = Number(paymentAmounts[orderId]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a payment amount greater than zero.");
      return;
    }

    setProcessingOrderId(orderId);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-orders/${orderId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note: paymentNotes[orderId] || undefined }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to record payment.");
      }

      const updatedOrder = data as Receivable;
      setOrders((currentOrders) =>
        currentOrders.map((order) => order.order_id === orderId ? updatedOrder : order),
      );
      setPaymentAmounts((current) => ({ ...current, [orderId]: "" }));
      setPaymentNotes((current) => ({ ...current, [orderId]: "" }));
    } catch (error) {
      console.error("Failed to record receivable payment", error);
      setMessage(error instanceof Error ? error.message : "Failed to record payment.");
    } finally {
      setProcessingOrderId(null);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Payments</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Accounts receivable</h1>
          <p className="mt-2 text-slate-600">Record one or more customer payments and track each remaining balance.</p>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Outstanding balance</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{formatCurrency(outstandingTotal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Unpaid orders</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{outstandingCount}</p>
          </div>
        </section>

        {message && (
          <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {message}
          </p>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Receivable payment history</h2>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showSettledOrders}
                  onChange={(event) => setShowSettledOrders(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                />
                Show settled orders
              </label>
            </div>
          </div>

          {loading ? (
            <p className="px-5 py-8 text-slate-500">Loading receivables...</p>
          ) : visibleOrders.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-500">
              {showSettledOrders ? "No sales orders found." : "No outstanding customer balances."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Salesperson</th>
                    <th className="px-4 py-3 font-medium">Order date</th>
                    <th className="px-4 py-3 font-medium">Days in debt</th>
                    <th className="px-4 py-3 font-medium">Paid / history</th>
                    <th className="px-4 py-3 font-medium">Outstanding</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleOrders.map((order) => (
                    <tr key={order.order_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">SO-{order.order_id}</td>
                      <td className="px-4 py-3 text-slate-600">{order.customer_name}</td>
                      <td className="px-4 py-3 text-slate-600">{order.salesperson?.staff_name ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(order.order_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {getDebtDays(order)} {getDebtDays(order) === 1 ? "day" : "days"}
                        {getOutstanding(order) <= 0.000001 && (
                          <span className="block text-xs font-normal text-emerald-700">to settle</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p className="font-semibold text-slate-900">
                          {formatCurrency(order.total_amount - getOutstanding(order))} paid
                        </p>
                        {order.payments.length > 0 ? (
                          <ul className="mt-1 space-y-1 text-xs">
                            {order.payments.map((payment) => (
                              <li key={payment.payment_id}>
                                {formatCurrency(Number(payment.amount))} · {new Date(payment.paid_at).toLocaleString()}
                                {payment.note ? ` · ${payment.note}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs">No payments recorded</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-700">{formatCurrency(getOutstanding(order))}</td>
                      <td className="px-4 py-3">
                        {getOutstanding(order) > 0.000001 ? (
                          <div className="flex min-w-40 flex-col gap-2">
                            <input
                              aria-label={`Payment amount for order SO-${order.order_id}`}
                              type="number"
                              min="0.01"
                              max={getOutstanding(order)}
                              step="0.01"
                              value={paymentAmounts[order.order_id] ?? ""}
                              onChange={(event) =>
                                setPaymentAmounts((current) => ({
                                  ...current,
                                  [order.order_id]: event.target.value,
                                }))
                              }
                              placeholder="Amount"
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <input
                              aria-label={`Payment note for order SO-${order.order_id}`}
                              type="text"
                              maxLength={191}
                              value={paymentNotes[order.order_id] ?? ""}
                              onChange={(event) =>
                                setPaymentNotes((current) => ({
                                  ...current,
                                  [order.order_id]: event.target.value,
                                }))
                              }
                              placeholder="Note (optional)"
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => void recordPayment(order.order_id)}
                              disabled={processingOrderId !== null}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {processingOrderId === order.order_id ? "Recording..." : "Record payment"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
