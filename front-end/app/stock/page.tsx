"use client";

import { useEffect, useState } from "react";

type Product = {
  product_id: number;
  product_name: string;
};

type Warehouse = {
  warehouse_id: number;
  warehouse_name: string;
};

type Vehicle = {
  vehicle_id: number;
  vehicle_name: string;
};

type Staff = {
  staff_id: number;
  staff_name: string;
};

type WarehouseStock = {
  warehouse_id: number;
  product_id: number;
  quantity: number;
  warehouse?: { warehouse_name: string };
  product?: { product_name: string };
};

type VehicleStock = {
  vehicle_id: number;
  product_id: number;
  quantity: number;
  vehicle?: { vehicle_name: string };
  product?: { product_name: string };
};

type MovementForm = {
  movementType: "in" | "out" | "transfer";
  sourceLocationType: "warehouse" | "vehicle";
  destinationLocationType: "warehouse" | "vehicle";
  staffId: string;
  productId: string;
  quantity: string;
  sourceId: string;
  destinationId: string;
};

const initialForm: MovementForm = {
  movementType: "in",
  sourceLocationType: "warehouse",
  destinationLocationType: "warehouse",
  staffId: "1",
  productId: "",
  quantity: "1",
  sourceId: "",
  destinationId: "",
};

export default function StockPage() {
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([]);
  const [vehicleStocks, setVehicleStocks] = useState<VehicleStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<MovementForm>(initialForm);

  async function loadStockData() {
    try {
      const [warehouseResponse, vehicleResponse, productResponse, warehouseListResponse, vehicleListResponse, staffResponse] = await Promise.all([
        fetch("http://localhost:3000/api/warehouse-stocks"),
        fetch("http://localhost:3000/api/vehicle-stocks"),
        fetch("http://localhost:3000/api/products"),
        fetch("http://localhost:3000/api/warehouses"),
        fetch("http://localhost:3000/api/vehicles"),
        fetch("http://localhost:3000/api/staff"),
      ]);

      const [warehouseData, vehicleData, productData, warehouseListData, vehicleListData, staffData] = await Promise.all([
        warehouseResponse.json(),
        vehicleResponse.json(),
        productResponse.json(),
        warehouseListResponse.json(),
        vehicleListResponse.json(),
        staffResponse.json(),
      ]);

      setWarehouseStocks(Array.isArray(warehouseData) ? warehouseData : []);
      setVehicleStocks(Array.isArray(vehicleData) ? vehicleData : []);
      setProducts(Array.isArray(productData) ? productData : []);
      setWarehouses(Array.isArray(warehouseListData) ? warehouseListData : []);
      setVehicles(Array.isArray(vehicleListData) ? vehicleListData : []);
      setStaff(Array.isArray(staffData) ? staffData : []);

      if (productData[0]) {
        setForm((current) => ({ ...current, productId: String(productData[0].product_id) }));
      }

      if (staffData[0]) {
        setForm((current) => ({ ...current, staffId: String(staffData[0].staff_id) }));
      }
    } catch (error) {
      console.error("Failed to load stock data", error);
      setMessage("Failed to load stock data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStockData();
  }, []);

  const warehouseLowStock = warehouseStocks.filter((item) => (item.quantity ?? 0) <= 10);
  const vehicleLowStock = vehicleStocks.filter((item) => (item.quantity ?? 0) <= 10);

  const sourceOptions: Array<Warehouse | Vehicle> = form.sourceLocationType === "warehouse" ? warehouses : vehicles;
  const destinationOptions: Array<Warehouse | Vehicle> = form.destinationLocationType === "warehouse" ? warehouses : vehicles;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const productId = Number(form.productId);
    const quantity = Number(form.quantity);
    const staffId = Number(form.staffId);

    if (!productId || !quantity || quantity <= 0) {
      setMessage("Please choose a valid product and quantity.");
      return;
    }

    if (form.movementType === "in" && !form.destinationId) {
      setMessage("Please select a destination.");
      return;
    }

    if ((form.movementType === "out" || form.movementType === "transfer") && !form.sourceId) {
      setMessage("Please select a source.");
      return;
    }

    if (form.movementType === "transfer" && !form.destinationId) {
      setMessage("Please select both source and destination for a transfer.");
      return;
    }

    if (form.movementType === "transfer" && Number(form.sourceId) === Number(form.destinationId) && form.sourceLocationType === form.destinationLocationType) {
      setMessage("Source and destination must be different.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload: any = {
        movement_type: form.movementType,
        from_location_type: form.sourceLocationType,
        to_location_type: form.destinationLocationType,
        staff_id: staffId,
        product_id: productId,
        quantity,
      };

      if (form.movementType === "in") {
        if (form.destinationLocationType === "warehouse") {
          payload.to_warehouse_id = Number(form.destinationId);
        } else {
          payload.to_vehicle_id = Number(form.destinationId);
        }
      } else if (form.movementType === "out") {
        if (form.sourceLocationType === "warehouse") {
          payload.from_warehouse_id = Number(form.sourceId);
        } else {
          payload.from_vehicle_id = Number(form.sourceId);
        }
      } else if (form.movementType === "transfer") {
        if (form.sourceLocationType === "warehouse") {
          payload.from_warehouse_id = Number(form.sourceId);
        } else {
          payload.from_vehicle_id = Number(form.sourceId);
        }

        if (form.destinationLocationType === "warehouse") {
          payload.to_warehouse_id = Number(form.destinationId);
        } else {
          payload.to_vehicle_id = Number(form.destinationId);
        }
      }

      const response = await fetch("http://localhost:3000/api/inventory-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Movement failed");
      }

      setMessage("Stock movement recorded successfully.");
      setForm((current) => ({
        ...current,
        quantity: "1",
        sourceId: "",
        destinationId: "",
      }));
      await loadStockData();
    } catch (error) {
      console.error("Stock movement failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to record stock movement.");
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = form.sourceLocationType === "warehouse" ? "Warehouse" : "Vehicle";
  const destinationLabel = form.destinationLocationType === "warehouse" ? "Warehouse" : "Vehicle";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Inventory</p>
          <h1 className="mt-2 text-3xl font-bold">Stock overview</h1>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Warehouse stock rows</p>
            <p className="mt-4 text-3xl font-bold text-cyan-300">{warehouseStocks.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Vehicle stock rows</p>
            <p className="mt-4 text-3xl font-bold text-violet-300">{vehicleStocks.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Low warehouse stock</p>
            <p className="mt-4 text-3xl font-bold text-amber-300">{warehouseLowStock.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Low vehicle stock</p>
            <p className="mt-4 text-3xl font-bold text-rose-300">{vehicleLowStock.length}</p>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Move stock</h2>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
              Inventory transaction
            </span>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Movement</span>
              <select
                value={form.movementType}
                onChange={(event) => setForm((current) => ({ ...current, movementType: event.target.value as MovementForm["movementType"] }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
              >
                <option value="in">Stock in</option>
                <option value="out">Stock out</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>

            {(form.movementType === "out" || form.movementType === "transfer") && (
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Source type</span>
                <select
                  value={form.sourceLocationType}
                  onChange={(event) => setForm((current) => ({ ...current, sourceLocationType: event.target.value as MovementForm["sourceLocationType"], sourceId: "" }))}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="vehicle">Vehicle</option>
                </select>
              </label>
            )}

            {(form.movementType === "in" || form.movementType === "transfer") && (
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Destination type</span>
                <select
                  value={form.destinationLocationType}
                  onChange={(event) => setForm((current) => ({ ...current, destinationLocationType: event.target.value as MovementForm["destinationLocationType"], destinationId: "" }))}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="vehicle">Vehicle</option>
                </select>
              </label>
            )}

            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Staff</span>
              <select
                value={form.staffId}
                onChange={(event) => setForm((current) => ({ ...current, staffId: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
              >
                {staff.map((member) => (
                  <option key={member.staff_id} value={member.staff_id}>{member.staff_name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Product</span>
              <select
                value={form.productId}
                onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.product_id} value={product.product_id}>{product.product_name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Quantity</span>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
              />
            </label>

            {(form.movementType === "out" || form.movementType === "transfer") && (
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Source {sourceLabel}</span>
                <select
                  value={form.sourceId}
                  onChange={(event) => setForm((current) => ({ ...current, sourceId: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                >
                  <option value="">Select source</option>
                  {sourceOptions.map((item) => {
                    if (form.sourceLocationType === "warehouse") {
                      const warehouse = item as Warehouse;
                      return (
                        <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                          {warehouse.warehouse_name}
                        </option>
                      );
                    }

                    const vehicle = item as Vehicle;
                    return (
                      <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                        {vehicle.vehicle_name}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}

            {(form.movementType === "in" || form.movementType === "transfer") && (
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Destination {destinationLabel}</span>
                <select
                  value={form.destinationId}
                  onChange={(event) => setForm((current) => ({ ...current, destinationId: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                >
                  <option value="">Select destination</option>
                  {destinationOptions.map((item) => {
                    if (form.destinationLocationType === "warehouse") {
                      const warehouse = item as Warehouse;
                      return (
                        <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                          {warehouse.warehouse_name}
                        </option>
                      );
                    }

                    const vehicle = item as Vehicle;
                    return (
                      <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                        {vehicle.vehicle_name}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}

            <div className="md:col-span-2 xl:col-span-3 flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Saving..." : "Record movement"}
              </button>
              {message && <p className="text-sm text-cyan-300">{message}</p>}
            </div>
          </form>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
            Loading stock data...
          </div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Warehouse stock</h2>
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                  {warehouseStocks.length} records
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="px-3 py-3 font-medium">Warehouse</th>
                      <th className="px-3 py-3 font-medium">Product</th>
                      <th className="px-3 py-3 font-medium">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                    {warehouseStocks.length > 0 ? (
                      warehouseStocks.map((item) => (
                        <tr key={`${item.warehouse_id}-${item.product_id}`} className={item.quantity <= 10 ? "bg-amber-500/5" : ""}>
                          <td className="px-3 py-3 text-slate-200">{item.warehouse?.warehouse_name ?? `Warehouse ${item.warehouse_id}`}</td>
                          <td className="px-3 py-3 text-slate-200">{item.product?.product_name ?? `Product ${item.product_id}`}</td>
                          <td className={`px-3 py-3 font-medium ${item.quantity <= 10 ? "text-amber-300" : "text-emerald-300"}`}>
                            {item.quantity}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                          No warehouse stock available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Vehicle stock</h2>
                <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                  {vehicleStocks.length} records
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="px-3 py-3 font-medium">Vehicle</th>
                      <th className="px-3 py-3 font-medium">Product</th>
                      <th className="px-3 py-3 font-medium">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                    {vehicleStocks.length > 0 ? (
                      vehicleStocks.map((item) => (
                        <tr key={`${item.vehicle_id}-${item.product_id}`} className={item.quantity <= 10 ? "bg-rose-500/5" : ""}>
                          <td className="px-3 py-3 text-slate-200">{item.vehicle?.vehicle_name ?? `Vehicle ${item.vehicle_id}`}</td>
                          <td className="px-3 py-3 text-slate-200">{item.product?.product_name ?? `Product ${item.product_id}`}</td>
                          <td className={`px-3 py-3 font-medium ${item.quantity <= 10 ? "text-rose-300" : "text-emerald-300"}`}>
                            {item.quantity}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                          No vehicle stock available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
