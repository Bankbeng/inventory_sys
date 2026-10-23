"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/date";

type Receivable = {
  order_id: number;
  customer_name: string;
  total_amount: number;
  order_date: string;
  is_paid: boolean;
  customer?: {
    phone_number: string | null;
    place_link: string | null;
  } | null;
  salesperson?: { staff_name: string };
  details: {
    product_id: number;
    quantity_sold: number;
    sold_at_price: number;
    product?: { product_name: string };
  }[];
  payments: {
    payment_id: number;
    amount: number;
    paid_at: string;
    note: string | null;
    recordedBy?: { staff_name: string } | null;
  }[];
};

type ReportGroup = {
  name: string;
  orders: Receivable[];
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

function groupOutstandingOrders(
  orders: Receivable[],
  groupBy: "salesperson" | "customer",
): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();

  for (const order of orders) {
    const outstanding = getOutstanding(order);
    if (outstanding <= 0.000001) continue;

    const name = groupBy === "salesperson"
      ? order.salesperson?.staff_name?.trim() || "Unknown"
      : order.customer_name?.trim() || "Unknown";
    const group = groups.get(name) ?? { name, orders: [] };
    group.orders.push(order);
    groups.set(name, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      orders: group.orders.sort(
        (left, right) => new Date(left.order_date).getTime() - new Date(right.order_date).getTime(),
      ),
    }))
    .sort(
      (left, right) => getGroupOutstanding(right) - getGroupOutstanding(left) ||
        left.name.localeCompare(right.name),
    );
}

function getGroupOutstanding(group: ReportGroup) {
  return group.orders.reduce((sum, order) => sum + getOutstanding(order), 0);
}

function getGroupPaid(group: ReportGroup) {
  return group.orders.reduce((sum, order) => sum + order.total_amount - getOutstanding(order), 0);
}

export default function AccountsReceivablePage() {
  const [orders, setOrders] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<number, string>>({});
  const [paymentNotes, setPaymentNotes] = useState<Record<number, string>>({});
  const [showSettledOrders, setShowSettledOrders] = useState(false);
  const [reportGroupBy, setReportGroupBy] = useState<"salesperson" | "customer">("salesperson");
  const [reportEntity, setReportEntity] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [printTimestamp, setPrintTimestamp] = useState<number | null>(null);
  const [printRequestId, setPrintRequestId] = useState(0);

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

  useEffect(() => {
    if (printRequestId > 0) {
      window.print();
    }
  }, [printRequestId]);

  const outstandingTotal = useMemo(
    () => orders.reduce((sum, order) => sum + getOutstanding(order), 0),
    [orders],
  );
  const outstandingCount = orders.filter((order) => getOutstanding(order) > 0.000001).length;
  const visibleOrders = showSettledOrders
    ? orders
    : orders.filter((order) => getOutstanding(order) > 0.000001);
  const reportGroups = useMemo(
    () => groupOutstandingOrders(orders, reportGroupBy),
    [orders, reportGroupBy],
  );
  const visibleReportGroups = reportEntity === "all"
    ? reportGroups
    : reportGroups.filter((group) => group.name === reportEntity);
  const reportTotal = visibleReportGroups.reduce((sum, group) => sum + getGroupOutstanding(group), 0);
  const reportOrderCount = visibleReportGroups.reduce((sum, group) => sum + group.orders.length, 0);

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

      const updatedOrder = data as Partial<Receivable>;
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.order_id === orderId ? { ...order, ...updatedOrder } : order,
        ),
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

        <section className="print-report mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 print:hidden">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Outstanding receivables report</h2>
              <p className="mt-1 text-sm text-slate-600">
                Order-by-order balances, products, and payment history grouped by salesperson or customer.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="receivable-report-group">Group report by</label>
              <select
                id="receivable-report-group"
                value={reportGroupBy}
                onChange={(event) => {
                  setReportGroupBy(event.target.value as "salesperson" | "customer");
                  setReportEntity("all");
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                <option value="salesperson">By salesperson</option>
                <option value="customer">By customer</option>
              </select>
              <label className="sr-only" htmlFor="receivable-report-entity">
                Select {reportGroupBy === "salesperson" ? "salesperson" : "customer"}
              </label>
              <select
                id="receivable-report-entity"
                value={reportEntity}
                onChange={(event) => setReportEntity(event.target.value)}
                className="min-w-48 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                <option value="all">
                  All {reportGroupBy === "salesperson" ? "salespeople" : "customers"}
                </option>
                {reportGroups.map((group) => (
                  <option key={group.name} value={group.name}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setPrintTimestamp(Date.now());
                  setPrintRequestId((current) => current + 1);
                }}
                disabled={loading || visibleReportGroups.length === 0}
                className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Print report
              </button>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-5 hidden print:block">
              <h1 className="text-2xl font-bold">Outstanding receivables report</h1>
              <p className="mt-1 text-sm">
                Grouped by {reportGroupBy === "salesperson" ? "salesperson" : "customer"} ·
                {" "}{reportEntity === "all" ? "All" : reportEntity} ·
                {" "}Printed {printTimestamp === null ? "—" : formatDateTime(printTimestamp)}
              </p>
              <p className="mt-2 text-sm">
                {reportOrderCount} outstanding orders · {formatCurrency(reportTotal)} remaining
              </p>
            </div>
            {loading ? (
              <p className="py-5 text-sm text-slate-500">Loading report...</p>
            ) : visibleReportGroups.length === 0 ? (
              <p className="py-5 text-sm text-slate-500">
                {reportEntity === "all"
                  ? "There are no outstanding balances to report."
                  : `No outstanding balances for ${reportEntity}.`}
              </p>
            ) : (
              <div className="space-y-6">
                {visibleReportGroups.map((group) => (
                  <section key={group.name} className="overflow-hidden rounded-xl border border-slate-200 print:break-inside-avoid">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{group.name}</h3>
                        {reportGroupBy === "customer" && (
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            {group.orders[0]?.customer?.phone_number && (
                              <span>Phone: {group.orders[0].customer.phone_number}</span>
                            )}
                            {group.orders[0]?.customer?.place_link && (
                              <a
                                href={group.orders[0].customer.place_link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-700 underline print:text-black"
                              >
                                Customer map
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-right text-xs text-slate-600">
                        {group.orders.length} unpaid {group.orders.length === 1 ? "order" : "orders"} ·
                        {" "}{formatCurrency(getGroupOutstanding(group))} due ·
                        {" "}{formatCurrency(getGroupPaid(group))} paid
                      </p>
                    </div>

                    {group.orders.map((order) => {
                      const outstanding = getOutstanding(order);
                      const paid = order.total_amount - outstanding;
                      return (
                        <article key={order.order_id} className="border-t border-slate-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-slate-900">SO-{order.order_id} · {order.customer_name}</h4>
                              <p className="mt-1 text-xs text-slate-600">
                                Salesperson: {order.salesperson?.staff_name ?? "Unknown"} ·
                                {" "}Order date: {formatDate(order.order_date)} ·
                                {" "}{getDebtDays(order)} {getDebtDays(order) === 1 ? "day" : "days"} outstanding
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-x-4 text-right text-xs">
                              <span className="text-slate-500">Order total</span>
                              <span className="text-slate-500">Paid</span>
                              <span className="font-semibold text-amber-700">Balance due</span>
                              <span className="font-medium text-slate-900">{formatCurrency(order.total_amount)}</span>
                              <span className="font-medium text-emerald-700">{formatCurrency(paid)}</span>
                              <span className="font-bold text-amber-700">{formatCurrency(outstanding)}</span>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-4 md:grid-cols-2">
                            <div>
                              <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Items</h5>
                              {order.details.length > 0 ? (
                                <ul className="space-y-1 text-xs text-slate-700">
                                  {order.details.map((detail) => (
                                    <li key={`${order.order_id}-${detail.product_id}`} className="flex justify-between gap-3">
                                      <span>
                                        {detail.product?.product_name ?? `Product ${detail.product_id}`} × {detail.quantity_sold}
                                        {" "}@ {formatCurrency(detail.sold_at_price)}
                                      </span>
                                      <span className="shrink-0 font-medium">
                                        {formatCurrency(detail.quantity_sold * detail.sold_at_price)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-slate-500">No item details available.</p>
                              )}
                            </div>
                            <div>
                              <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment history</h5>
                              {order.payments.length > 0 ? (
                                <ul className="space-y-1 text-xs text-slate-700">
                                  {order.payments.map((payment) => (
                                    <li key={payment.payment_id} className="flex justify-between gap-3">
                                      <span>
                                        {formatDate(payment.paid_at)}
                                        {payment.note ? ` · ${payment.note}` : ""}
                                        {" "}· Recorded by {payment.recordedBy?.staff_name ?? "Unknown"}
                                      </span>
                                      <span className="shrink-0 font-medium">{formatCurrency(Number(payment.amount))}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-slate-500">No payments recorded.</p>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                ))}

                <div className="flex flex-wrap justify-end gap-x-6 gap-y-2 border-t-2 border-slate-300 pt-4 text-sm">
                  <span>{reportOrderCount} unpaid orders</span>
                  <span>Total paid: <strong>{formatCurrency(visibleReportGroups.reduce((sum, group) => sum + getGroupPaid(group), 0))}</strong></span>
                  <span>Total outstanding: <strong>{formatCurrency(reportTotal)}</strong></span>
                </div>
              </div>
            )}
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
                      <td className="px-4 py-3 text-slate-600">{formatDate(order.order_date)}</td>
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
                                {formatCurrency(Number(payment.amount))} · {formatDateTime(payment.paid_at)}
                                {payment.note ? ` · ${payment.note}` : ""}
                                {" "}· Recorded by {payment.recordedBy?.staff_name ?? "Unknown"}
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
      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 16mm;
          }

          body * {
            visibility: hidden !important;
          }

          .print-report,
          .print-report * {
            visibility: visible !important;
          }

          .print-report {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          .print-report section,
          .print-report article {
            break-inside: avoid;
          }

          .print-report .overflow-hidden {
            overflow: visible !important;
          }
        }
      `}</style>
    </main>
  );
}
