"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";

type SalesOrder = {
  total_amount: number;
  order_date: string;
  salesperson?: { staff_id: number; staff_name: string };
  details?: {
    quantity_sold: number;
    sold_at_price: number;
    product?: { category: string };
  }[];
};

type SalesCategory = { name: string; total: number; quantity: number };
type RankedSalesperson = {
  staffId: number;
  name: string;
  total: number;
  categories: SalesCategory[];
};
type SalesPeriod = "all" | "range";

function localDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function SalesKpiPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function loadSalesOrders() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/sales-orders`);
        if (!response.ok) throw new Error("Sales orders request failed.");

        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (loadError) {
        console.error("Failed to load sales KPI data", loadError);
        setError("Sales data could not be loaded. Check the API connection and try again.");
      } finally {
        setLoading(false);
      }
    }

    loadSalesOrders();
  }, []);

  const periodOrders = orders.filter((order) => {
    if (salesPeriod === "all") return true;
    if (!startDate || !endDate || startDate > endDate) return false;

    const orderDate = localDateKey(order.order_date);
    return orderDate >= startDate && orderDate <= endDate;
  });

  const salespersonTotals = new Map<number, RankedSalesperson>();
  const categoryTotals = new Map<number, Map<string, SalesCategory>>();
  for (const order of periodOrders) {
    if (!order.salesperson) continue;

    const { staff_id: staffId, staff_name: name } = order.salesperson;
    const existing = salespersonTotals.get(staffId);
    salespersonTotals.set(staffId, {
      staffId,
      name,
      total: (existing?.total ?? 0) + (order.total_amount ?? 0),
      categories: [],
    });

    let personCategories = categoryTotals.get(staffId);
    if (!personCategories) {
      personCategories = new Map<string, SalesCategory>();
      categoryTotals.set(staffId, personCategories);
    }

    for (const detail of order.details ?? []) {
      const categoryName = detail.product?.category?.trim() || "Uncategorized";
      const category = personCategories.get(categoryName);
      personCategories.set(categoryName, {
        name: categoryName,
        total: (category?.total ?? 0) + detail.quantity_sold * detail.sold_at_price,
        quantity: (category?.quantity ?? 0) + detail.quantity_sold,
      });
    }
  }

  const rankedSalespeople = [...salespersonTotals.values()].map((person) => ({
    ...person,
    categories: [...(categoryTotals.get(person.staffId)?.values() ?? [])].sort(
      (first, second) => second.total - first.total || first.name.localeCompare(second.name),
    ),
  })).sort(
    (first, second) => second.total - first.total || first.name.localeCompare(second.name),
  );
  const validDateRange = Boolean(startDate && endDate && startDate <= endDate);
  const reportIsReady = salesPeriod === "all" || validDateRange;
  const reportSalesTotal = reportIsReady
    ? periodOrders.reduce((total, order) => total + (Number(order.total_amount) || 0), 0)
    : 0;
  const averageOrderValue = periodOrders.length > 0 ? reportSalesTotal / periodOrders.length : 0;
  const leadingSalesperson = rankedSalespeople[0];
  const topSalesTotal = leadingSalesperson?.total ?? 0;

  return (
    <main className="min-h-screen bg-[#f3f6f5] px-4 py-6 text-slate-900 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="relative mb-7 overflow-hidden rounded-3xl bg-[#103f3a] px-6 py-7 text-white shadow-lg shadow-teal-950/10 sm:px-9 sm:py-9">
          <div className="absolute -top-24 right-[-3rem] h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -top-12 right-5 h-52 w-52 rounded-full border border-white/10" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-teal-200 uppercase">Performance report</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Sales at a glance</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-teal-50/75">
                Compare team performance and see what each salesperson is selling.
              </p>
            </div>
            {!loading && !error && (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] font-medium tracking-wide text-teal-100/70 uppercase">Report period</p>
                <p className="mt-1 text-sm font-semibold">
                  {salesPeriod === "all"
                    ? "All time"
                    : startDate && endDate && startDate <= endDate
                      ? `${startDate} – ${endDate}`
                      : "Choose a valid date range"}
                </p>
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-600 shadow-sm" role="status">
            Loading sales report...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-6 text-sm text-rose-800" role="alert">
            {error}
          </div>
        ) : (
          <>
            <section aria-label="Report filters" className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:px-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">Reporting period</p>
                <p className="mt-1 text-xs text-slate-500">Choose which orders to include in this report.</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <fieldset>
                  <legend className="mb-1.5 text-xs font-medium text-slate-500">Period</legend>
                  <div className="inline-flex rounded-lg bg-slate-100 p-1" aria-label="Sales ranking period">
                    {(["all", "range"] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        aria-pressed={salesPeriod === period}
                        onClick={() => setSalesPeriod(period)}
                        className={[
                          "rounded-md px-3 py-2 text-xs font-semibold transition-colors",
                          salesPeriod === period
                            ? "bg-white text-teal-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900",
                        ].join(" ")}
                      >
                        {period === "all" ? "All time" : "Date range"}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {salesPeriod === "range" && (
                  <>
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Start date
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      End date
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                      />
                    </label>
                  </>
                )}
              </div>
            </section>

            {salesPeriod === "range" && !validDateRange ? (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
                {!startDate || !endDate
                  ? "Select both a start date and an end date to view the report."
                  : "Start date must be on or before end date."}
              </div>
            ) : null}

            <section aria-label="Sales summary" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">ຍອດຂາຍທັງໝົດ</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-teal-900">{reportIsReady ? formatCurrency(reportSalesTotal) : "--"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Across {reportIsReady ? periodOrders.length : "--"} orders
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Salespeople</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{reportIsReady ? rankedSalespeople.length : "--"}</p>
                <p className="mt-1 text-xs text-slate-500">With recorded sales</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Average order</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{reportIsReady ? formatCurrency(averageOrderValue) : "--"}</p>
                <p className="mt-1 text-xs text-slate-500">Sales total divided by orders</p>
              </article>
              <article className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">Top salesperson</p>
                <p className="mt-3 truncate text-xl font-semibold tracking-tight text-teal-950">
                  {reportIsReady ? leadingSalesperson?.name ?? "—" : "--"}
                </p>
                <p className="mt-1 text-xs text-teal-800/75">
                  {reportIsReady && leadingSalesperson ? formatCurrency(leadingSalesperson.total) : "Highest sales total"}
                </p>
              </article>
            </section>

            <section aria-labelledby="sales-rank-heading" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">Leaderboard</p>
                  <h2 id="sales-rank-heading" className="mt-1 text-lg font-semibold text-slate-950">Sales by salesperson</h2>
                </div>
                <p className="text-xs text-slate-500">Ranked by sales total</p>
              </div>
              {reportIsReady && rankedSalespeople.length > 0 ? (
                <div className="space-y-4" role="list" aria-label="Sales totals chart">
                  {rankedSalespeople.map((person, index) => {
                    const share = topSalesTotal > 0 ? (person.total / topSalesTotal) * 100 : 0;
                    return (
                      <div key={person.staffId} className="grid gap-2 sm:grid-cols-[minmax(10rem,0.8fr)_2fr_auto] sm:items-center sm:gap-5" role="listitem">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={[
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            index === 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500",
                          ].join(" ")}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate text-sm font-semibold text-slate-800">{person.name}</span>
                        </div>
                        <div
                          className="h-3 overflow-hidden rounded-full bg-slate-100"
                          role="img"
                          aria-label={`${person.name}: ${share.toFixed(0)} percent of the top salesperson's total`}
                        >
                          <div
                            className={[
                              "h-full rounded-full transition-[width] duration-500",
                              index === 0 ? "bg-teal-700" : "bg-teal-500",
                            ].join(" ")}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <p className="text-right text-sm font-semibold tabular-nums text-slate-950">{formatCurrency(person.total)}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {reportIsReady ? "No salesperson sales recorded for this period." : "Choose a valid date range to view sales."}
                </p>
              )}
            </section>

            <section aria-labelledby="category-breakdown-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase">Product mix</p>
                  <h2 id="category-breakdown-heading" className="mt-1 text-lg font-semibold text-slate-950">Category breakdown</h2>
                </div>
                <p className="text-xs text-slate-500">Item totals before order discounts and tax</p>
              </div>
              {reportIsReady && rankedSalespeople.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {rankedSalespeople.map((person, index) => {
                    const categoryTotal = person.categories.reduce((total, category) => total + category.total, 0);
                    return (
                      <article key={person.staffId} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xs font-bold text-teal-800">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-slate-900">{person.name}</h3>
                              <p className="mt-0.5 text-xs text-slate-500">Sales total</p>
                            </div>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-950">{formatCurrency(person.total)}</p>
                        </div>
                        {person.categories.length > 0 ? (
                          <ul className="space-y-3">
                            {person.categories.map((category) => {
                              const categoryShare = categoryTotal > 0 ? (category.total / categoryTotal) * 100 : 0;
                              return (
                                <li key={category.name}>
                                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                                    <span className="font-medium text-slate-700">{category.name}</span>
                                    <span className="text-right tabular-nums text-slate-600">
                                      {formatCurrency(category.total)}
                                      <span className="ml-1.5 text-slate-400">· {category.quantity} units</span>
                                    </span>
                                  </div>
                                  <div
                                    className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                                    role="img"
                                    aria-label={`${category.name}: ${categoryShare.toFixed(0)} percent of ${person.name}'s category sales`}
                                  >
                                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${categoryShare}%` }} />
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="rounded-lg bg-slate-50 px-3 py-4 text-xs text-slate-500">No category sales recorded.</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {reportIsReady ? "No category sales recorded for this period." : "Choose a valid date range to view category sales."}
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}