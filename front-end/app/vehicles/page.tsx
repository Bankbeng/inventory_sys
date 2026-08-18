"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";

type Vehicle = {
  vehicle_id: number;
  vehicle_name: string;
};

type VehicleFormState = {
  vehicle_name: string;
};

const emptyForm: VehicleFormState = {
  vehicle_name: "",
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VehicleFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadVehicles() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/vehicles`);
      const data = await response.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load vehicles", error);
      setMessage("Failed to load vehicles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.vehicle_name.trim()) {
      setMessage("Vehicle name is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        editingId ? `${API_BASE_URL}/api/vehicles/${editingId}` : `${API_BASE_URL}/api/vehicles`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicle_name: form.vehicle_name.trim() }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      resetForm();
      await loadVehicles();
      setMessage(editingId ? "Vehicle updated successfully." : "Vehicle added successfully.");
    } catch (error) {
      console.error("Vehicle save failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to save vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(vehicleId: number) {
    const vehicle = vehicles.find((item) => item.vehicle_id === vehicleId);
    if (!vehicle) return;

    if (!window.confirm(`Delete ${vehicle.vehicle_name}?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Delete failed");
      }

      await loadVehicles();
      if (editingId === vehicleId) resetForm();
      setMessage("Vehicle deleted successfully.");
    } catch (error) {
      console.error("Vehicle delete failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to delete vehicle.");
    }
  }

  function handleEdit(vehicle: Vehicle) {
    setEditingId(vehicle.vehicle_id);
    setForm({ vehicle_name: vehicle.vehicle_name });
    setMessage(null);
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Fleet</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Vehicles</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Vehicle name</span>
              <input
                value={form.vehicle_name}
                onChange={(event) => setForm({ vehicle_name: event.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-cyan-400"
                placeholder="Truck 01"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update vehicle" : "Save vehicle"}
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
            Loading vehicles...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((vehicle) => (
              <article key={vehicle.vehicle_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">{vehicle.vehicle_name}</h2>
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                    Active
                  </span>
                </div>
                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  <p>ID: <span className="font-medium text-slate-900">#{vehicle.vehicle_id}</span></p>
                </div>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(vehicle)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-300 hover:text-slate-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(vehicle.vehicle_id)}
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
