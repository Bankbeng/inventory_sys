"use client";

import { useEffect, useState } from "react";

type Warehouse = {
  warehouse_id: number;
  warehouse_name: string;
};

type WarehouseFormState = {
  warehouse_name: string;
};

const emptyForm: WarehouseFormState = {
  warehouse_name: "",
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WarehouseFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadWarehouses() {
    try {
      const response = await fetch("http://localhost:3000/api/warehouses");
      const data = await response.json();
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load warehouses", error);
      setMessage("Failed to load warehouses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.warehouse_name.trim()) {
      setMessage("Warehouse name is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        editingId ? `http://localhost:3000/api/warehouses/${editingId}` : "http://localhost:3000/api/warehouses",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warehouse_name: form.warehouse_name.trim() }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      resetForm();
      await loadWarehouses();
      setMessage(editingId ? "Warehouse updated successfully." : "Warehouse added successfully.");
    } catch (error) {
      console.error("Warehouse save failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to save warehouse.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(warehouseId: number) {
    const warehouse = warehouses.find((item) => item.warehouse_id === warehouseId);
    if (!warehouse) return;

    if (!window.confirm(`Delete ${warehouse.warehouse_name}?`)) return;

    try {
      const response = await fetch(`http://localhost:3000/api/warehouses/${warehouseId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Delete failed");
      }

      await loadWarehouses();
      if (editingId === warehouseId) resetForm();
      setMessage("Warehouse deleted successfully.");
    } catch (error) {
      console.error("Warehouse delete failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to delete warehouse.");
    }
  }

  function handleEdit(warehouse: Warehouse) {
    setEditingId(warehouse.warehouse_id);
    setForm({ warehouse_name: warehouse.warehouse_name });
    setMessage(null);
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Storage</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Warehouses</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Warehouse name</span>
              <input
                value={form.warehouse_name}
                onChange={(event) => setForm({ warehouse_name: event.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-cyan-400"
                placeholder="Central Warehouse"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update warehouse" : "Save warehouse"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Clear form
              </button>
            )}
          </div>

          {message && <p className="mt-4 text-sm text-cyan-700">{message}</p>}
        </form>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            Loading warehouses...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {warehouses.map((warehouse) => (
              <article key={warehouse.warehouse_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">{warehouse.warehouse_name}</h2>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  <p>ID: <span className="font-medium text-slate-900">#{warehouse.warehouse_id}</span></p>
                </div>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(warehouse)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-300 hover:text-slate-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(warehouse.warehouse_id)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
