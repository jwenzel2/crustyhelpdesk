"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Ticket = {
  id: string;
  title: string;
  description: string;
  clientMachine: string;
  status: string;
  issueTimeStart: string;
  issueTimeEnd: string;
  reportedAt: string;
  createdAt: string;
  createdBy: { displayName: string };
  logRequests: {
    id: string;
    logType: string;
    status: string;
    createdAt: string;
    logEntries: { id: string; eventId: number; level: string; source: string; message: string; timestamp: string }[];
  }[];
};

const statuses = ["OPEN", "IN_PROGRESS", "AWAITING_LOGS", "RESOLVED", "CLOSED"] as const;

const statusColors: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  AWAITING_LOGS: "bg-purple-100 text-purple-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/tickets/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setTicket)
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTicket((prev) => (prev ? { ...prev, ...updated } : prev));
    }
    setUpdating(false);
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!ticket) return <div className="text-red-600">Ticket not found.</div>;

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => router.push("/tickets")}
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
      >
        &larr; Back to tickets
      </button>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Created by {ticket.createdBy.displayName} on{" "}
              {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <span
            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColors[ticket.status] || "bg-gray-100"}`}
          >
            {ticket.status.replace("_", " ")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Client Machine</h3>
            <p className="mt-1 font-mono text-gray-900">{ticket.clientMachine}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Issue Timeframe</h3>
            <p className="mt-1 text-gray-900">
              {new Date(ticket.issueTimeStart).toLocaleString()} &mdash;{" "}
              {new Date(ticket.issueTimeEnd).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
          <p className="text-gray-900 whitespace-pre-wrap">{ticket.description}</p>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Update Status</h3>
          <div className="flex gap-2 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s}
                disabled={ticket.status === s || updating}
                onClick={() => updateStatus(s)}
                className={`px-3 py-1 text-xs rounded-full border ${
                  ticket.status === s
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Log Requests</h3>
          {ticket.logRequests.length === 0 ? (
            <p className="text-gray-400 text-sm">No log requests yet.</p>
          ) : (
            <div className="space-y-2">
              {ticket.logRequests.map((lr) => (
                <div key={lr.id} className="bg-gray-50 rounded p-3 text-sm">
                  <span className="font-medium">{lr.logType}</span> &mdash;{" "}
                  <span className="text-gray-600">{lr.status}</span> &mdash;{" "}
                  <span className="text-gray-500">
                    {lr.logEntries.length} entries
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            disabled
            className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-md text-sm opacity-50 cursor-not-allowed"
            title="Agent integration coming in Phase 3"
          >
            Request Logs (coming soon)
          </button>
        </div>
      </div>
    </div>
  );
}
