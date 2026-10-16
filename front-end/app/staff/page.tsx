"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";

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

type RolePage = {
  path: string;
  label: string;
};

type RolePermission = {
  role_name: string;
  accessible_pages: string[];
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
  const [permissionPages, setPermissionPages] = useState<RolePage[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedPermissionRole, setSelectedPermissionRole] = useState("");
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsMessage, setPermissionsMessage] = useState<string | null>(null);

  async function loadStaff() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/staff`);
      const data = await response.json();
      setStaffMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load staff", error);
      setMessage("Failed to load staff records.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRolePermissions() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/role-permissions`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load role permissions.");
      }
      const roles: RolePermission[] = Array.isArray(data.roles) ? data.roles : [];
      setPermissionPages(Array.isArray(data.pages) ? data.pages : []);
      setRolePermissions(roles);
      setSelectedPermissionRole((current) =>
        roles.some((role) => role.role_name === current) ? current : roles[0]?.role_name ?? "",
      );
    } catch (error) {
      console.error("Failed to load role permissions", error);
      setPermissionsMessage(error instanceof Error ? error.message : "Failed to load role permissions.");
    } finally {
      setPermissionsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadStaff();
      void loadRolePermissions();
    });
  }, []);

  const selectedRolePermissions = rolePermissions.find(
    (role) => role.role_name === selectedPermissionRole,
  );

  function togglePagePermission(pagePath: string, checked: boolean) {
    setRolePermissions((current) =>
      current.map((role) =>
        role.role_name === selectedPermissionRole
          ? {
              ...role,
              accessible_pages: checked
                ? [...role.accessible_pages, pagePath]
                : role.accessible_pages.filter((page) => page !== pagePath),
            }
          : role,
      ),
    );
  }

  async function saveRolePermissions() {
    if (!selectedRolePermissions) return;
    setPermissionsSaving(true);
    setPermissionsMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/role-permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_name: selectedRolePermissions.role_name,
          accessible_pages: selectedRolePermissions.accessible_pages,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save role permissions.");
      }
      setPermissionsMessage(`Permissions saved for ${selectedRolePermissions.role_name}.`);
    } catch (error) {
      console.error("Failed to save role permissions", error);
      setPermissionsMessage(error instanceof Error ? error.message : "Failed to save role permissions.");
    } finally {
      setPermissionsSaving(false);
    }
  }

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
        editingId ? `${API_BASE_URL}/api/staff/${editingId}` : `${API_BASE_URL}/api/staff`,
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
      await loadRolePermissions();
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
      const response = await fetch(`${API_BASE_URL}/api/staff/${staffId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Delete failed");
      }

      await loadStaff();
      await loadRolePermissions();
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
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Team</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Staff management</h1>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Role page access</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose which pages each role can open. New roles can access every page except Staff until customized.
              Admins always have access to every page.
            </p>
          </div>

          {permissionsLoading ? (
            <p className="text-sm text-slate-600">Loading role permissions...</p>
          ) : rolePermissions.length === 0 ? (
            <p className="text-sm text-slate-600">Add a non-admin staff role to configure page access.</p>
          ) : (
            <>
              <label className="mb-4 block max-w-sm text-sm text-slate-700">
                <span className="mb-2 block">Staff role</span>
                <select
                  value={selectedPermissionRole}
                  onChange={(event) => setSelectedPermissionRole(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                >
                  {rolePermissions.map((role) => (
                    <option key={role.role_name} value={role.role_name}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {permissionPages.map((page) => (
                  <label
                    key={page.path}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRolePermissions?.accessible_pages.includes(page.path) ?? false}
                      onChange={(event) => togglePagePermission(page.path, event.target.checked)}
                      className="h-4 w-4 accent-cyan-600"
                    />
                    {page.label}
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveRolePermissions}
                  disabled={permissionsSaving || !selectedRolePermissions}
                  className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {permissionsSaving ? "Saving..." : "Save page access"}
                </button>
                {permissionsMessage && (
                  <p role="status" className="text-sm text-cyan-700">{permissionsMessage}</p>
                )}
              </div>
            </>
          )}
          {permissionsMessage && rolePermissions.length === 0 && (
            <p role="alert" className="mt-3 text-sm text-rose-700">{permissionsMessage}</p>
          )}
        </section>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Full name</span>
              <input
                value={form.staff_name}
                onChange={(event) => handleChange("staff_name", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-cyan-400"
                placeholder="John Smith"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Username</span>
              <input
                value={form.username}
                onChange={(event) => handleChange("username", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-cyan-400"
                placeholder="john"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => handleChange("password", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-cyan-400"
                placeholder={editingId ? "Leave blank to keep current" : "********"}
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Role</span>
              <input
                value={form.role}
                onChange={(event) => handleChange("role", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                placeholder="Enter role"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update staff" : "Save staff"}
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

          {message && (
            <p className="mt-4 text-sm text-cyan-700">{message}</p>
          )}
        </form>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            Loading staff...
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {staffMembers.length > 0 ? (
                  staffMembers.map((member) => (
                    <tr key={member.staff_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">#{member.staff_id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{member.staff_name}</td>
                      <td className="px-4 py-3 text-slate-600">{member.username}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-700">
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(member)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-300 hover:text-slate-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(member.staff_id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
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
