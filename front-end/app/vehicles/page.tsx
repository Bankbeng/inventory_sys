"use client";

import { useEffect, useState } from "react";

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
      const response = await fetch("http://localhost:3000/api/vehicles");
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
        editingId ? `http://localhost:3000/api/vehicles/${editingId}` : "http://localhost:3000/api/vehicles",
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
      const response = await fetch(`http://localhost:3000/api/vehicles/${vehicleId}`, {
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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Fleet</p>
            <h1 className="mt-2 text-3xl font-bold">Vehicles</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Vehicle name</span>
              <input
                value={form.vehicle_name}
                onChange={(event) => setForm({ vehicle_name: event.target.value })}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                placeholder="Truck 01"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update vehicle" : "Save vehicle"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Clear form
              </button>
            )}
          </div>

          {message && <p className="mt-4 text-sm text-cyan-300">{message}</p>}
        </form>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
            Loading vehicles...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((vehicle) => (
              <article key={vehicle.vehicle_id} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">{vehicle.vehicle_name}</h2>
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                    Active
                  </span>
                </div>
                <div className="mt-5 space-y-2 text-sm text-slate-300">
                  <p>ID: <span className="font-medium text-white">#{vehicle.vehicle_id}</span></p>
                </div>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(vehicle)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/60 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(vehicle.vehicle_id)}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
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
