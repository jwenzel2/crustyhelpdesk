"use client";

import { useEffect, useState } from "react";

interface AgentToken {
  id: string;
  machineName: string;
  description: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export default function AgentTokensPage() {
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [machineName, setMachineName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  async function fetchTokens() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/agent/tokens");
      if (res.status === 403) {
        setError("You do not have permission to manage agent tokens.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load tokens");
      setTokens(await res.json());
    } catch {
      setError("Failed to load agent tokens.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTokens();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setNewToken(null);

    try {
      const res = await fetch("/api/agent/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineName, description: description || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create token");
      }

      const data = await res.json();
      setNewToken(data.token);
      setMachineName("");
      setDescription("");
      setShowForm(false);
      fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(token: AgentToken) {
    if (!confirm(`Revoke token for "${token.machineName}"? The agent will stop working.`)) {
      return;
    }

    setError("");
    try {
      const res = await fetch(`/api/agent/tokens?id=${token.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke token");
      }
      fetchTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Agent Tokens</h1>
      <p className="text-sm text-gray-600 mb-6">
        Manage API tokens for log collection agents running on client machines.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {newToken && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md mb-4">
          <p className="font-medium mb-1">Token created! Copy it now — it will not be shown again.</p>
          <code className="block bg-green-100 px-3 py-2 rounded text-sm font-mono break-all select-all">
            {newToken}
          </code>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Tokens</h2>
        {!showForm && !loading && !error?.includes("permission") && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
          >
            Create Token
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Agent Token</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Machine Name (hostname)
              </label>
              <input
                type="text"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                required
                pattern="^[a-zA-Z0-9._-]+$"
                placeholder="WORKSTATION-01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black"
                placeholder="Engineering lab workstation"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
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
          <p className="text-gray-500">Loading tokens...</p>
        </div>
      ) : (
        !error?.includes("permission") && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Machine</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Last Seen</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tokens.map((token) => (
                  <tr key={token.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-mono font-medium">
                      {token.machineName}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {token.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {token.lastSeenAt
                        ? new Date(token.lastSeenAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(token.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRevoke(token)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
                {tokens.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      No agent tokens yet.
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
