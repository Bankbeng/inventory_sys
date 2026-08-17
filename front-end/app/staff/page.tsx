"use client";

import { useEffect, useState } from "react";

type StaffMember = {
  staff_id: number;
  staff_name: string;
  username: string;
  role: string;
  password?: string;
};

type StaffFormState = {
  staff_name: string;
  username: string;
  password: string;
  role: string;
};

const emptyForm: StaffFormState = {
  staff_name: "",
  username: "",
  password: "",
  role: "Staff",
};

export default function StaffPage() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<StaffFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStaff() {
    try {
      const response = await fetch("http://localhost:3000/api/staff");
      const data = await response.json();
      setStaffMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load staff", error);
      setMessage("Failed to load staff records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  const handleChange = (field: keyof StaffFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.staff_name.trim() || !form.username.trim() || !form.role.trim()) {
      setMessage("Name, username, and role are required.");
      return;
    }

    if (!editingId && !form.password.trim()) {
      setMessage("Password is required when creating a staff member.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        staff_name: form.staff_name.trim(),
        username: form.username.trim(),
        role: form.role.trim(),
        ...(editingId ? {} : { password: form.password }),
        ...(editingId && form.password.trim() ? { password: form.password } : {}),
      };

      const response = await fetch(
        editingId ? `http://localhost:3000/api/staff/${editingId}` : "http://localhost:3000/api/staff",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      resetForm();
      await loadStaff();
      setMessage(editingId ? "Staff updated successfully." : "Staff added successfully.");
    } catch (error) {
      console.error("Staff save failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to save the staff record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(staffId: number) {
    const member = staffMembers.find((item) => item.staff_id === staffId);
    if (!member) return;

    if (!window.confirm(`Delete ${member.staff_name}?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/staff/${staffId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Delete failed");
      }

      await loadStaff();
      if (editingId === staffId) {
        resetForm();
      }
      setMessage("Staff deleted successfully.");
    } catch (error) {
      console.error("Staff delete failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to delete staff record.");
    }
  }

  function handleEdit(member: StaffMember) {
    setEditingId(member.staff_id);
    setForm({
      staff_name: member.staff_name,
      username: member.username,
      password: "",
      role: member.role,
    });
    setMessage(null);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Team</p>
            <h1 className="mt-2 text-3xl font-bold">Staff management</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Full name</span>
              <input
                value={form.staff_name}
                onChange={(event) => handleChange("staff_name", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
                placeholder="John Smith"
              />
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Username</span>
              <input
                value={form.username}
                onChange={(event) => handleChange("username", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
                placeholder="john"
              />
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => handleChange("password", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 transition focus:border-cyan-400"
                placeholder={editingId ? "Leave blank to keep current" : "********"}
              />
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Role</span>
              <select
                value={form.role}
                onChange={(event) => handleChange("role", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-cyan-400"
              >
                <option value="Manager">Manager</option>
                <option value="Warehouse Lead">Warehouse Lead</option>
                <option value="Sales Agent">Sales Agent</option>
                <option value="Driver">Driver</option>
                <option value="Staff">Staff</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update staff" : "Save staff"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              >
                Clear form
              </button>
            )}
          </div>

          {message && (
            <p className="mt-4 text-sm text-cyan-300">{message}</p>
          )}
        </form>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
            Loading staff...
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {staffMembers.length > 0 ? (
                  staffMembers.map((member) => (
                    <tr key={member.staff_id} className="hover:bg-slate-800/80">
                      <td className="px-4 py-3 text-slate-300">#{member.staff_id}</td>
                      <td className="px-4 py-3 font-medium text-white">{member.staff_name}</td>
                      <td className="px-4 py-3 text-slate-300">{member.username}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(member)}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/60 hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(member.staff_id)}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No staff records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
