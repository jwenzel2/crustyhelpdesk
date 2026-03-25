"use client";

import { useEffect, useState } from "react";
import { useSiteSettings } from "@/components/site-settings-context";

// ─── Types ────────────────────────────────────────────────────

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  createdAt: string;
}

interface UserForm {
  username: string;
  displayName: string;
  email: string;
  password: string;
  role: string;
}

interface Category {
  id: string;
  name: string;
}

const emptyUserForm: UserForm = {
  username: "",
  displayName: "",
  email: "",
  password: "",
  role: "CLIENT",
};

type Tab = "users" | "categories" | "site" | "email";

const TAB_LABELS: Record<Tab, string> = {
  users: "Users",
  categories: "Categories",
  site: "Site",
  email: "Email",
};

// ─── Component ────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Settings</h1>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["users", "categories", "site", "email"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
              tab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "site" && <SiteTab />}
      {tab === "email" && <EmailTab />}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);
  const [submitting, setSubmitting] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users");
      if (res.status === 403) {
        setError("You do not have permission to manage users.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load users");
      setUsers(await res.json());
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyUserForm);
    setShowForm(true);
    setError("");
  }

  function openEdit(user: User) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      password: "",
      role: user.role,
    });
    setShowForm(true);
    setError("");
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyUserForm);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (editingId) {
        const body: Record<string, string> = {};
        if (form.displayName) body.displayName = form.displayName;
        if (form.email) body.email = form.email;
        if (form.role) body.role = form.role;
        if (form.password) body.password = form.password;

        const res = await fetch(`/api/users/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update user");
        }
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create user");
        }
      }

      cancelForm();
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete user "${user.displayName}"? This cannot be undone.`)) {
      return;
    }

    setError("");
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        {!showForm && !loading && !error?.includes("permission") && (
          <button
            onClick={openCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            Add User
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? "Edit User" : "Create User"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password{editingId && " (leave blank to keep current)"}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                required={!editingId}
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
              >
                <option value="CLIENT">Client</option>
                <option value="LEVEL_1">Level 1 Tech</option>
                <option value="LEVEL_2">Level 2 Tech</option>
                <option value="LEVEL_3">Level 3 Tech</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-500">Loading users...</p>
        </div>
      ) : (
        !error?.includes("permission") && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Username</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Display Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Role</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{user.username}</td>
                    <td className="px-4 py-3 text-gray-700">{user.displayName}</td>
                    <td className="px-4 py-3 text-gray-700">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : user.role === "LEVEL_3"
                              ? "bg-red-100 text-red-800"
                              : user.role === "LEVEL_2"
                                ? "bg-orange-100 text-orange-800"
                                : user.role === "LEVEL_1"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {user.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(user)}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchCategories() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      setCategories(await res.json());
    } catch {
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  function openCreate() {
    setEditingId(null);
    setName("");
    setShowForm(true);
    setError("");
  }

  function openEdit(cat: Category) {
    setEditingId(cat.id);
    setName(cat.name);
    setShowForm(true);
    setError("");
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (editingId) {
        const res = await fetch(`/api/categories/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update category");
        }
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create category");
        }
      }

      cancelForm();
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Delete category "${cat.name}"?`)) return;

    setError("");
    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete category");
      }
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Category Management</h2>
        {!showForm && !loading && (
          <button
            onClick={openCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            Add Category
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? "Edit Category" : "Create Category"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                required
                maxLength={100}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-500">Loading categories...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(cat)}
                      className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-gray-500">
                    No categories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Site Tab ─────────────────────────────────────────────────

function SiteTab() {
  const { siteName, siteUrl, refreshSiteSettings } = useSiteSettings();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.siteName) setName(data.siteName);
        if (data?.siteUrl) setUrl(data.siteUrl);
      })
      .catch(() => setError("Failed to load settings."))
      .finally(() => setLoading(false));
  }, []);

  const hasChanges = name !== siteName || url !== siteUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName: name, siteUrl: url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update settings");
      }

      setSuccess("Settings updated.");
      refreshSiteSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Settings</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
              required
              maxLength={100}
              placeholder="CrustyHelpdesk"
            />
            <p className="mt-1 text-xs text-gray-500">
              Displayed in the sidebar, login page, and browser tab.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
              maxLength={255}
              placeholder="https://localhost:3000"
            />
            <p className="mt-1 text-xs text-gray-500">
              The base URL for the app (e.g. https://help.example.com). Used for agent connections and link generation. Leave blank to use the current host.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting || !hasChanges}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Email Tab ───────────────────────────────────────────────

interface SmtpForm {
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

const emptySmtpForm: SmtpForm = {
  smtpEnabled: false,
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
};

function EmailTab() {
  const [form, setForm] = useState<SmtpForm>(emptySmtpForm);
  const [saved, setSaved] = useState<SmtpForm>(emptySmtpForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.smtp) {
          const f: SmtpForm = {
            smtpEnabled: data.smtp.smtpEnabled ?? false,
            smtpHost: data.smtp.smtpHost ?? "",
            smtpPort: String(data.smtp.smtpPort ?? 587),
            smtpSecure: data.smtp.smtpSecure ?? false,
            smtpUser: data.smtp.smtpUser ?? "",
            smtpPass: data.smtp.smtpPass ?? "",
            smtpFrom: data.smtp.smtpFrom ?? "",
          };
          setForm(f);
          setSaved(f);
        }
      })
      .catch(() => setError("Failed to load SMTP settings."))
      .finally(() => setLoading(false));
  }, []);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(saved);

  function updateField<K extends keyof SmtpForm>(key: K, value: SmtpForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp: {
            smtpEnabled: form.smtpEnabled,
            smtpHost: form.smtpHost,
            smtpPort: parseInt(form.smtpPort, 10),
            smtpSecure: form.smtpSecure,
            smtpUser: form.smtpUser,
            smtpPass: form.smtpPass,
            smtpFrom: form.smtpFrom,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save SMTP settings");
      }

      setSaved({ ...form });
      setSuccess("SMTP settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings/smtp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: form.smtpHost,
          smtpPort: parseInt(form.smtpPort, 10),
          smtpSecure: form.smtpSecure,
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          smtpFrom: form.smtpFrom,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Connection test failed");
      }

      setSuccess("SMTP connection successful!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500">Loading SMTP settings...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Email Notifications (SMTP)
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.smtpEnabled}
                onChange={(e) => updateField("smtpEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">
              Enable email notifications
            </span>
          </div>

          <p className="text-xs text-gray-500">
            When enabled, clients receive email notifications when their tickets
            are created and when there are updates.
          </p>

          {/* SMTP fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMTP Host
              </label>
              <input
                type="text"
                value={form.smtpHost}
                onChange={(e) => updateField("smtpHost", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMTP Port
              </label>
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => updateField("smtpPort", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                placeholder="587"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="smtpSecure"
              checked={form.smtpSecure}
              onChange={(e) => updateField("smtpSecure", e.target.checked)}
              className="rounded border-gray-300"
            />
            <label
              htmlFor="smtpSecure"
              className="text-sm font-medium text-gray-700"
            >
              Use SSL/TLS (port 465). Leave unchecked for STARTTLS (port 587).
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={form.smtpUser}
                onChange={(e) => updateField("smtpUser", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={form.smtpPass}
                onChange={(e) => updateField("smtpPass", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Address
            </label>
            <input
              type="text"
              value={form.smtpFrom}
              onChange={(e) => updateField("smtpFrom", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
              placeholder='"CrustyHelpdesk" <noreply@example.com>'
            />
            <p className="mt-1 text-xs text-gray-500">
              The sender address for outgoing notification emails.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || !hasChanges}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !form.smtpHost}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-300 disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
