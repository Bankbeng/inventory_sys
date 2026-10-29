"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";

type Stock = {
  quantity: number;
  product?: { cost_price: number; retail_price: number };
};

type SalesOrder = {
  total_amount: number;
  order_date: string;
  details?: {
    quantity_sold: number;
    sold_at_price: number;
    product?: {
      product_id: number;
      product_name: string;
      category: string;
      type: string;
      size: string;
      unit: string;
    };
  }[];
};

type ProductSales = {
  productId: number;
  name: string;
  category: string;
  unit: string;
  quantitySold: number;
  revenue: number;
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

export default function DashboardPage() {
  const [warehouseStocks, setWarehouseStocks] = useState<Stock[]>([]);
  const [vehicleStocks, setVehicleStocks] = useState<Stock[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [warehouseResponse, vehicleResponse, ordersResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/warehouse-stocks`),
          fetch(`${API_BASE_URL}/api/vehicle-stocks`),
          fetch(`${API_BASE_URL}/api/sales-orders`),
        ]);

        if (!warehouseResponse.ok || !vehicleResponse.ok || !ordersResponse.ok) {
          throw new Error("Dashboard API request failed.");
        }

        const [warehouseData, vehicleData, ordersData] = await Promise.all([
          warehouseResponse.json(),
          vehicleResponse.json(),
          ordersResponse.json(),
        ]);
        setWarehouseStocks(Array.isArray(warehouseData) ? warehouseData : []);
        setVehicleStocks(Array.isArray(vehicleData) ? vehicleData : []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      } catch (loadError) {
        console.error("Failed to load dashboard data", loadError);
        setError("Dashboard data could not be loaded. Check the API connection and try again.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const validDateRange = Boolean(startDate && endDate && startDate <= endDate);
  const periodOrders = orders.filter((order) => {
    if (salesPeriod === "all") return true;
    if (!validDateRange) return false;

    const orderDate = localDateKey(order.order_date);
    return orderDate >= startDate && orderDate <= endDate;
  });
  const totalSales = periodOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
  const categoryTotals = new Map<string, number>();
  const productTotals = new Map<number, ProductSales>();
  for (const order of periodOrders) {
    for (const detail of order.details ?? []) {
      const category = detail.product?.category || "Uncategorized";
      const quantity = Number(detail.quantity_sold) || 0;
      const lineTotal = quantity * (Number(detail.sold_at_price) || 0);
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + lineTotal);

      const productId = detail.product?.product_id;
      if (productId === undefined) continue;

      const current = productTotals.get(productId) ?? {
        productId,
        name: detail.product?.product_name || `Product ${productId}`,
        category,
        unit: detail.product?.unit || "",
        quantitySold: 0,
        revenue: 0,
      };
      current.quantitySold += quantity;
      current.revenue += lineTotal;
      productTotals.set(productId, current);
    }
  }
  const categorySales = [...categoryTotals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((first, second) => second.amount - first.amount || first.category.localeCompare(second.category));
  const categorySalesTotal = categorySales.reduce((sum, item) => sum + item.amount, 0);
  const productSales = [...productTotals.values()].sort(
    (first, second) => second.revenue - first.revenue || second.quantitySold - first.quantitySold || first.name.localeCompare(second.name),
  );
  const salesTotalMessage = salesPeriod === "all"
    ? "Combined value of all recorded sales orders"
    : !startDate || !endDate
      ? "Select both a start date and an end date."
      : startDate > endDate
        ? "Start date must be on or before end date."
        : "Sales within the selected date range";
  const inventoryValue = (stocks: Stock[], price: "cost_price" | "retail_price") =>
    stocks.reduce((total, stock) => total + (stock.quantity ?? 0) * (stock.product?.[price] ?? 0), 0);

  const warehouseCost = inventoryValue(warehouseStocks, "cost_price");
  const vehicleCost = inventoryValue(vehicleStocks, "cost_price");
  const warehouseRetail = inventoryValue(warehouseStocks, "retail_price");
  const vehicleRetail = inventoryValue(vehicleStocks, "retail_price");

  return (
    <main className="min-h-screen bg-[#f4f6f3] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">Business overview</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sales &amp; inventory</h1>
          </div>
          <p className="text-sm text-slate-500">Stock values reflect current inventory</p>
        </header>

        {loading ? (
          <div className="border-y border-slate-300 py-8 text-sm text-slate-600" role="status">Loading dashboard data...</div>
        ) : error ? (
          <div className="border-y border-rose-300 py-6 text-sm text-rose-800" role="alert">{error}</div>
        ) : (
          <>
            <section aria-labelledby="sales-total-heading" className="border-y border-slate-300 py-6">
              <div className="flex flex-wrap items-end justify-between gap-5">
                <div>
                  <h2 id="sales-total-heading" className="text-sm font-medium text-slate-600">Sales total</h2>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-teal-800 sm:text-5xl">
                    {salesPeriod === "range" && !validDateRange ? "--" : formatCurrency(totalSales)}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <p className="pb-1 text-sm text-slate-500">{salesTotalMessage}</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <fieldset>
                      <legend className="mb-1.5 text-xs font-medium text-slate-500">Period</legend>
                      <div className="inline-flex rounded-md border border-slate-300 p-0.5" aria-label="Sales total period">
                        {(["all", "range"] as const).map((period) => (
                          <button
                            key={period}
                            type="button"
                            aria-pressed={salesPeriod === period}
                            onClick={() => setSalesPeriod(period)}
                            className={[
                              "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                              salesPeriod === period
                                ? "bg-teal-800 text-white"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                            ].join(" ")}
                          >
                            {period === "all" ? "All time" : "Date range"}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {salesPeriod === "range" && (
                      <label className="grid gap-1 text-xs font-medium text-slate-500">
                        Start date
                        <input
                          type="date"
                          value={startDate}
                          onChange={(event) => setStartDate(event.target.value)}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                        />
                      </label>
                    )}
                    {salesPeriod === "range" && (
                      <label className="grid gap-1 text-xs font-medium text-slate-500">
                        End date
                        <input
                          type="date"
                          value={endDate}
                          onChange={(event) => setEndDate(event.target.value)}
                          className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="category-sales-heading" className="border-b border-slate-300 py-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="category-sales-heading" className="text-lg font-semibold text-slate-950">Sales by product category</h2>
                <p className="text-xs text-slate-500">Based on sold quantities and unit prices</p>
              </div>
              {salesPeriod === "range" && !validDateRange ? (
                <p className="py-4 text-sm text-slate-500">Select a valid date range to see category sales.</p>
              ) : categorySales.length > 0 ? (
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                  {categorySales.map(({ category, amount }) => {
                    const share = categorySalesTotal > 0 ? (amount / categorySalesTotal) * 100 : 0;
                    return (
                      <div key={category} className="grid gap-2 py-3 sm:grid-cols-[minmax(10rem,1fr)_2fr_auto] sm:items-center sm:gap-5">
                        <span className="text-sm font-medium text-slate-800">{category}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                          <div className="h-full rounded-full bg-teal-700" style={{ width: `${share}%` }} />
                        </div>
                        <span className="text-right text-sm font-semibold tabular-nums text-slate-950">
                          {formatCurrency(amount)}
                          <span className="ml-2 text-xs font-normal text-slate-500">{share.toFixed(1)}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-4 text-sm text-slate-500">No category sales recorded for this period.</p>
              )}
            </section>

            <section aria-labelledby="product-sales-heading" className="border-b border-slate-300 py-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="product-sales-heading" className="text-lg font-semibold text-slate-950">Sales by product</h2>
                <p className="text-xs text-slate-500">Ranked by revenue · quantity sold in the selected period</p>
              </div>
              {salesPeriod === "range" && !validDateRange ? (
                <p className="py-4 text-sm text-slate-500">Select a valid date range to see product sales.</p>
              ) : productSales.length > 0 ? (
                <div className="overflow-x-auto border-y border-slate-200">
                  <table className="w-full min-w-120 text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                      <tr>
                        <th scope="col" className="w-16 py-3 pr-4 font-medium">Rank</th>
                        <th scope="col" className="py-3 pr-4 font-medium">Product</th>
                        <th scope="col" className="py-3 pr-4 font-medium">Category</th>
                        <th scope="col" className="py-3 pr-4 text-right font-medium">Qty sold</th>
                        <th scope="col" className="py-3 text-right font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {productSales.map((item, index) => (
                        <tr key={item.productId}>
                          <td className="py-3 pr-4 font-mono text-xs text-slate-500">{index + 1}</td>
                          <td className="py-3 pr-4 font-medium text-slate-800">
                            {item.name}
                            {item.unit && <span className="ml-1 text-xs font-normal text-slate-500">({item.unit})</span>}
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{item.category}</td>
                          <td className="py-3 pr-4 text-right font-medium tabular-nums text-slate-800">{item.quantitySold}</td>
                          <td className="py-3 text-right font-semibold tabular-nums text-teal-800">{formatCurrency(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-sm text-slate-500">No product sales recorded for this period.</p>
              )}
            </section>

            <section aria-labelledby="inventory-value-heading" className="border-t border-slate-300 pt-7 pb-10">
              <div className="mb-5">
                <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">Current stock</p>
                <h2 id="inventory-value-heading" className="mt-1 text-xl font-semibold text-slate-950">Inventory value by price</h2>
              </div>
              <div className="grid gap-8 md:grid-cols-2">
                <ValueSummary title="Cost price" warehouseValue={warehouseCost} vehicleValue={vehicleCost} />
                <ValueSummary title="Retail price" warehouseValue={warehouseRetail} vehicleValue={vehicleRetail} />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ValueSummary({
  title,
  warehouseValue,
  vehicleValue,
}: {
  title: string;
  warehouseValue: number;
  vehicleValue: number;
}) {
  return (
    <article className="border-t-2 border-teal-700 pt-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <dl className="mt-4 space-y-3">
        <div className="flex justify-between gap-4 text-sm">
          <dt className="text-slate-600">Warehouse</dt>
          <dd className="font-medium tabular-nums text-slate-900">{formatCurrency(warehouseValue)}</dd>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <dt className="text-slate-600">Vehicles</dt>
          <dd className="font-medium tabular-nums text-slate-900">{formatCurrency(vehicleValue)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-slate-300 pt-3 text-sm">
          <dt className="font-semibold text-slate-800">Warehouse + vehicles</dt>
          <dd className="font-semibold tabular-nums text-teal-800">{formatCurrency(warehouseValue + vehicleValue)}</dd>
        </div>
      </dl>
    </article>
  );
}
