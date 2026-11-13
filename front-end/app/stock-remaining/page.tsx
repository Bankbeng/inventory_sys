"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatStockQuantity, getUnitsPerPack } from "@/lib/stock-units";

type Product = {
  product_id: number;
  product_name: string;
  category: string;
  type: string;
  size: string;
  unit: string;
};

type Warehouse = {
  warehouse_id: number;
  warehouse_name: string;
};

type Vehicle = {
  vehicle_id: number;
  vehicle_name: string;
};

type WarehouseStock = {
  warehouse_id: number;
  product_id: number;
  quantity: number;
  warehouse?: Warehouse;
  product?: Product;
};

type VehicleStock = {
  vehicle_id: number;
  product_id: number;
  quantity: number;
  vehicle?: Vehicle;
  product?: Product;
};

type StockDisplayMode = "product" | "warehouse" | "vehicle";

function getProductLabel(product: Pick<Product, "product_name" | "type" | "size" | "unit">) {
  const attributes = [product.type, [product.size, product.unit].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return attributes ? `${product.product_name} (${attributes})` : product.product_name;
}

function StockQuantity({
  quantity,
  size,
  unit,
  className,
}: {
  quantity: number;
  size: string;
  unit: string;
  className: string;
}) {
  const unitsPerPack = getUnitsPerPack(size);
  if (!unitsPerPack || quantity < unitsPerPack) {
    return <span className={className}>{formatStockQuantity(quantity, size, unit)}</span>;
  }

  const packCount = Math.floor(quantity / unitsPerPack);
  const leftoverUnits = quantity % unitsPerPack;
  const unitLabel = unit || "units";

  return (
    <span className={`${className} whitespace-nowrap`}>
      <span className="block">
        {packCount} ແກັດ{leftoverUnits > 0 ? ` + ${leftoverUnits} ${unitLabel}` : ""}
      </span>
      <span className="block text-xs font-normal text-slate-500">
        {quantity} {unitLabel} total
      </span>
    </span>
  );
}

export default function RemainingStockPage() {
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([]);
  const [vehicleStocks, setVehicleStocks] = useState<VehicleStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [displayMode, setDisplayMode] = useState<StockDisplayMode>("product");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRemainingStock() {
      try {
        const [warehouseResponse, vehicleResponse, productResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/warehouse-stocks`),
          fetch(`${API_BASE_URL}/api/vehicle-stocks`),
          fetch(`${API_BASE_URL}/api/products`),
        ]);

        if (!warehouseResponse.ok || !vehicleResponse.ok || !productResponse.ok) {
          throw new Error("Remaining stock request failed.");
        }

        const [warehouseData, vehicleData, productData] = await Promise.all([
          warehouseResponse.json(),
          vehicleResponse.json(),
          productResponse.json(),
        ]);
        setWarehouseStocks(Array.isArray(warehouseData) ? warehouseData : []);
        setVehicleStocks(Array.isArray(vehicleData) ? vehicleData : []);
        setProducts(Array.isArray(productData) ? productData : []);
      } catch (loadError) {
        console.error("Failed to load remaining stock", loadError);
        setError("Remaining stock could not be loaded. Check the API connection and try again.");
      } finally {
        setLoading(false);
      }
    }

    loadRemainingStock();
  }, []);

  const sortedWarehouseStocks = [...warehouseStocks].sort((left, right) => {
    const leftWarehouse = left.warehouse?.warehouse_name ?? `Warehouse ${left.warehouse_id}`;
    const rightWarehouse = right.warehouse?.warehouse_name ?? `Warehouse ${right.warehouse_id}`;
    const leftProduct = left.product?.product_name ?? `Product ${left.product_id}`;
    const rightProduct = right.product?.product_name ?? `Product ${right.product_id}`;
    return leftWarehouse.localeCompare(rightWarehouse) || leftProduct.localeCompare(rightProduct);
  });

  const sortedVehicleStocks = [...vehicleStocks].sort((left, right) => {
    const leftVehicle = left.vehicle?.vehicle_name ?? `Vehicle ${left.vehicle_id}`;
    const rightVehicle = right.vehicle?.vehicle_name ?? `Vehicle ${right.vehicle_id}`;
    const leftProduct = left.product?.product_name ?? `Product ${left.product_id}`;
    const rightProduct = right.product?.product_name ?? `Product ${right.product_id}`;
    return leftVehicle.localeCompare(rightVehicle) || leftProduct.localeCompare(rightProduct);
  });

  const categories = Array.from(
    new Set(products.map((product) => product.category?.trim()).filter((category) => category)),
  ).sort((left, right) => left.localeCompare(right));

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const categoryMatches = selectedCategory === "all" || product.category?.trim() === selectedCategory;
    if (!categoryMatches) return false;
    if (!normalizedSearch) return true;

    const searchableText = [
      product.product_name,
      product.category,
      product.type,
      product.size,
      product.unit,
      String(product.product_id),
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  });

  const matchingProductIds = new Set(filteredProducts.map((product) => product.product_id));
  const visibleWarehouseStocks = sortedWarehouseStocks.filter((item) => matchingProductIds.has(item.product_id));
  const visibleVehicleStocks = sortedVehicleStocks.filter((item) => matchingProductIds.has(item.product_id));

  const remainingProductRows = filteredProducts
    .map((product) => {
      const warehouseEntries = warehouseStocks
        .filter((item) => item.product_id === product.product_id)
        .map((item) => ({
          name: item.warehouse?.warehouse_name ?? `Warehouse ${item.warehouse_id}`,
          quantity: item.quantity ?? 0,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
      const vehicleEntries = vehicleStocks
        .filter((item) => item.product_id === product.product_id)
        .map((item) => ({
          name: item.vehicle?.vehicle_name ?? `Vehicle ${item.vehicle_id}`,
          quantity: item.quantity ?? 0,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
      const warehouseQty = warehouseEntries.reduce((sum, item) => sum + item.quantity, 0);
      const vehicleQty = vehicleEntries.reduce((sum, item) => sum + item.quantity, 0);

      return {
        product_id: product.product_id,
        product_name: getProductLabel(product),
        size: product.size,
        unit: product.unit,
        warehouseEntries,
        vehicleEntries,
        totalQty: warehouseQty + vehicleQty,
      };
    })
    .sort((left, right) => left.product_name.localeCompare(right.product_name));

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Inventory</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Remaining stock</h1>
          </div>
          {!loading && !error && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm text-slate-700">
                <span className="mb-2 block">ຄົ້ນຫາ</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search product, category, type, or ID"
                  className="w-72 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400"
                />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-2 block">ປະເພດສິນຄ້າ</span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-cyan-400"
                >
                  <option value="all">ທຸກປະເພດສິນຄ້າ</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-2 block">ສະແດງອີງຕາມ</span>
                <select
                  value={displayMode}
                  onChange={(event) => setDisplayMode(event.target.value as StockDisplayMode)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-cyan-400"
                >
                  <option value="product">ສິນຄ້າ</option>
                  <option value="warehouse">ສາງ</option>
                  <option value="vehicle">ລົດ</option>
                </select>
              </label>
            </div>
          )}
        </header>

        {loading ? (
          <div className="border-y border-slate-200 py-8 text-sm text-slate-600" role="status">Loading remaining stock...</div>
        ) : error ? (
          <div className="border-y border-rose-300 py-6 text-sm text-rose-800" role="alert">{error}</div>
        ) : (
          <section aria-label={`${displayMode} stock`}>
            {displayMode === "product" && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th scope="col" className="border-r border-slate-200 px-4 py-3 font-semibold">Product</th>
                      <th scope="col" className="border-r border-slate-200 px-4 py-3 font-semibold">Warehouse stock</th>
                      <th scope="col" className="border-r border-slate-200 px-4 py-3 font-semibold">Vehicle stock</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Total remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                {remainingProductRows.length > 0 ? remainingProductRows.map((item) => (
                  <tr key={item.product_id} className="bg-white transition-colors hover:bg-cyan-50/50">
                    <td className="min-w-56 border-r border-slate-200 px-4 py-3.5">
                      <p className="font-semibold leading-5 text-slate-900">{item.product_name}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">ID #{item.product_id}</p>
                    </td>
                    <td className="min-w-56 border-r border-slate-200 px-4 py-3.5">
                      {item.warehouseEntries.length > 0 ? (
                        <ul className="space-y-1.5">
                          {item.warehouseEntries.map((entry) => (
                            <li key={entry.name} className="flex items-baseline justify-between gap-3">
                              <span className="text-slate-600">{entry.name}</span>
                              <StockQuantity
                                quantity={entry.quantity}
                                size={item.size}
                                unit={item.unit}
                                className="shrink-0 text-right font-semibold tabular-nums text-cyan-800"
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">No warehouse stock</span>
                      )}
                    </td>
                    <td className="min-w-56 border-r border-slate-200 px-4 py-3.5">
                      {item.vehicleEntries.length > 0 ? (
                        <ul className="space-y-1.5">
                          {item.vehicleEntries.map((entry) => (
                            <li key={entry.name} className="flex items-baseline justify-between gap-3">
                              <span className="text-slate-600">{entry.name}</span>
                              <StockQuantity
                                quantity={entry.quantity}
                                size={item.size}
                                unit={item.unit}
                                className="shrink-0 text-right font-semibold tabular-nums text-indigo-700"
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">No vehicle stock</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">
                      <StockQuantity
                        quantity={item.totalQty}
                        size={item.size}
                        unit={item.unit}
                        className={`text-base font-bold tabular-nums ${
                        item.totalQty <= 10 ? "text-amber-700" : "text-emerald-700"
                      }`}
                      />
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      {selectedCategory === "all" ? "No products available." : "No products match this category."}
                    </td>
                  </tr>
                )}
                  </tbody>
                </table>
              </div>
            )}

            {displayMode === "warehouse" && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th scope="col" className="border-r border-slate-200 px-4 py-3 font-semibold">Warehouse</th>
                      <th scope="col" className="border-r border-slate-200 px-4 py-3 font-semibold">Product</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                {visibleWarehouseStocks.length > 0 ? visibleWarehouseStocks.map((item) => (
                  <tr key={`${item.warehouse_id}-${item.product_id}`} className="bg-white transition-colors hover:bg-cyan-50/50">
                    <td className="border-r border-slate-200 px-4 py-3.5 font-medium text-cyan-800">
                      {item.warehouse?.warehouse_name ?? `Warehouse ${item.warehouse_id}`}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3.5 font-semibold text-slate-800">
                      {item.product ? getProductLabel(item.product) : `Product ${item.product_id}`}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3.5 text-right font-bold tabular-nums ${
                      item.quantity <= 10 ? "text-amber-700" : "text-emerald-700"
                    }`}>
                      {formatStockQuantity(item.quantity, item.product?.size ?? "", item.product?.unit ?? "")}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      {selectedCategory === "all" ? "No warehouse stock available." : "No warehouse stock for this category."}
                    </td>
                  </tr>
                )}
                  </tbody>
                </table>
              </div>
            )}

            {displayMode === "vehicle" && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th scope="col" className="border-r border-slate-200 px-4 py-3 font-semibold">Vehicle</th>
                      <th scope="col" className="border-r border-slate-200 px-4 py-3 font-semibold">Product</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                {visibleVehicleStocks.length > 0 ? visibleVehicleStocks.map((item) => (
                  <tr key={`${item.vehicle_id}-${item.product_id}`} className="bg-white transition-colors hover:bg-cyan-50/50">
                    <td className="border-r border-slate-200 px-4 py-3.5 font-medium text-indigo-700">
                      {item.vehicle?.vehicle_name ?? `Vehicle ${item.vehicle_id}`}
                    </td>
                    <td className="border-r border-slate-200 px-4 py-3.5 font-semibold text-slate-800">
                      {item.product ? getProductLabel(item.product) : `Product ${item.product_id}`}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3.5 text-right font-bold tabular-nums ${
                      item.quantity <= 10 ? "text-rose-700" : "text-emerald-700"
                    }`}>
                      {formatStockQuantity(item.quantity, item.product?.size ?? "", item.product?.unit ?? "")}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      {selectedCategory === "all" ? "No vehicle stock available." : "No vehicle stock for this category."}
                    </td>
                  </tr>
                )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}