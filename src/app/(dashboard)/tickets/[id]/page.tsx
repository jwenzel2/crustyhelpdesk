"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Tech = { id: string; displayName: string; role: string };

type Comment = {
  id: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
  author: { displayName: string; role: string } | null;
};

type Ticket = {
  id: string;
  title: string;
  description: string;
  clientMachine: string;
  status: string;
  priority: string;
  escalationLevel: number;
  issueTimeStart: string;
  issueTimeEnd: string;
  reportedAt: string;
  createdAt: string;
  createdBy: { displayName: string };
  assignedTo: { id: string; displayName: string } | null;
  category: { id: string; name: string } | null;
  logRequests: {
    id: string;
    logType: string;
    status: string;
    createdAt: string;
    logEntries: { id: string; eventId: number; level: string; source: string; message: string; timestamp: string }[];
  }[];
};

const priorityColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  AWAITING_LOGS: "bg-purple-100 text-purple-800",
  ESCALATED: "bg-orange-100 text-orange-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

const roleLabels: Record<string, string> = {
  CLIENT: "Client",
  LEVEL_1: "L1 Tech",
  LEVEL_2: "L2 Tech",
  LEVEL_3: "L3 Tech",
  ADMIN: "Admin",
};

const roleBadgeColors: Record<string, string> = {
  CLIENT: "bg-gray-100 text-gray-700",
  LEVEL_1: "bg-blue-100 text-blue-700",
  LEVEL_2: "bg-orange-100 text-orange-700",
  LEVEL_3: "bg-red-100 text-red-700",
  ADMIN: "bg-purple-100 text-purple-700",
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = session?.user?.id;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [techs, setTechs] = useState<Tech[]>([]);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Log request state
  const [showLogForm, setShowLogForm] = useState(false);
  const [selectedLogTypes, setSelectedLogTypes] = useState<string[]>([]);
  const [requestingLogs, setRequestingLogs] = useState(false);

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

  // Fetch comments
  useEffect(() => {
    fetch(`/api/tickets/${id}/comments`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setComments)
      .catch(() => setComments([]));
  }, [id]);

  // Auto-refresh when log requests are pending or in-progress
  useEffect(() => {
    if (!ticket) return;
    const hasPending = ticket.logRequests.some(
      (lr) => lr.status === "PENDING" || lr.status === "IN_PROGRESS"
    );
    if (!hasPending) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/tickets/${id}`);
      if (res.ok) setTicket(await res.json());
    }, 10000);

    return () => clearInterval(interval);
  }, [ticket, id]);

  // Fetch techs for assignment (staff only)
  useEffect(() => {
    if (role && role !== "CLIENT") {
      fetch("/api/users/techs")
        .then((r) => (r.ok ? r.json() : []))
        .then(setTechs)
        .catch(() => setTechs([]));
    }
  }, [role]);

  async function patchTicket(body: Record<string, unknown>) {
    setUpdating(true);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const full = await fetch(`/api/tickets/${id}`);
      if (full.ok) setTicket(await full.json());
    }
    setUpdating(false);
  }

  function startEdit() {
    if (!ticket) return;
    setEditTitle(ticket.title);
    setEditDescription(ticket.description);
    setEditing(true);
  }

  async function saveEdit() {
    await patchTicket({ title: editTitle, description: editDescription });
    setEditing(false);
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPostingComment(true);
    const res = await fetch(`/api/tickets/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody }),
    });
    if (res.ok) {
      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setCommentBody("");
    }
    setPostingComment(false);
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!ticket) return <div className="text-red-600">Ticket not found.</div>;

  const isClient = role === "CLIENT";
  const isL1 = role === "LEVEL_1";
  const isL2 = role === "LEVEL_2";
  const isL3 = role === "LEVEL_3";
  const isAdmin = role === "ADMIN";
  const isAssignedToMe = ticket.assignedTo?.id === userId;

  const availableStatuses: string[] = [];
  if (isL1 || isL2 || isL3 || isAdmin) {
    availableStatuses.push("OPEN", "IN_PROGRESS", "AWAITING_LOGS", "RESOLVED", "CLOSED");
  }

  const canEscalateToL2 = (isL1 || isAdmin) && ticket.escalationLevel === 1;
  const canEscalateToL3 = (isL2 || isAdmin) && ticket.escalationLevel === 2;
  const canAssign = isL1 || isL2 || isL3 || isAdmin;
  const isClosed = ticket.status === "CLOSED";
  const canClose = !isClosed && (isClient || isAssignedToMe || isAdmin);
  const canPickUp =
    !isClient &&
    !isAssignedToMe &&
    ((isL1 && ticket.escalationLevel === 1) ||
      (isL2 && ticket.escalationLevel === 2) ||
      (isL3 && ticket.escalationLevel === 3) ||
      isAdmin);

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => router.push("/tickets")}
        className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
      >
        &larr; Back to tickets
      </button>

      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-2xl font-bold text-black border border-gray-300 rounded px-2 py-1 w-full"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Created by {ticket.createdBy.displayName} on{" "}
              {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {!isClient && (
              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">
                L{ticket.escalationLevel}
              </span>
            )}
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColors[ticket.status] || "bg-gray-100"}`}
            >
              {ticket.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Category</h3>
            <p className="mt-1 text-gray-900">{ticket.category?.name || "—"}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Priority</h3>
            <span
              className={`inline-flex mt-1 px-2 py-1 text-xs font-semibold rounded-full ${priorityColors[ticket.priority] || "bg-gray-100"}`}
            >
              {ticket.priority}
            </span>
          </div>
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
          {!isClient && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Assigned To</h3>
              <p className="mt-1 text-gray-900">
                {ticket.assignedTo?.displayName || "Unassigned"}
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
          {editing ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black"
            />
          ) : (
            <p className="text-gray-900 whitespace-pre-wrap">{ticket.description}</p>
          )}
        </div>

        {/* Client edit controls */}
        {isClient && (
          <div className="border-t pt-4 mb-4">
            {editing ? (
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={startEdit}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
                >
                  Edit Ticket
                </button>
                {canClose && (
                  <button
                    onClick={() => patchTicket({ status: "CLOSED" })}
                    disabled={updating}
                    className="px-4 py-2 bg-gray-700 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
                  >
                    Close Ticket
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Staff controls */}
        {!isClient && (
          <div className="border-t pt-4 space-y-4">
            {/* Pick up / Assign / Close */}
            <div className="flex flex-wrap items-center gap-3">
              {canClose && (
                <button
                  onClick={() => patchTicket({ status: "CLOSED" })}
                  disabled={updating}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
                >
                  Close Ticket
                </button>
              )}
              {canPickUp && (
                <button
                  onClick={() => patchTicket({ assignedToId: userId, status: "IN_PROGRESS" })}
                  disabled={updating}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Pick Up Ticket
                </button>
              )}

              {canAssign && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Assign to:</label>
                  <select
                    value={ticket.assignedTo?.id || ""}
                    onChange={(e) =>
                      patchTicket({
                        assignedToId: e.target.value || null,
                        ...(e.target.value ? { status: "IN_PROGRESS" } : {}),
                      })
                    }
                    disabled={updating}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm text-black"
                  >
                    <option value="">Unassigned</option>
                    {techs
                      .filter((t) => t.role === `LEVEL_${ticket.escalationLevel}`)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.displayName}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Status update */}
            {availableStatuses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Update Status</h3>
                <div className="flex gap-2 flex-wrap">
                  {availableStatuses.map((s) => (
                    <button
                      key={s}
                      disabled={ticket.status === s || updating}
                      onClick={() => patchTicket({ status: s })}
                      className={`px-3 py-1 text-xs rounded-full border ${
                        ticket.status === s
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      }`}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Escalation */}
            {(canEscalateToL2 || canEscalateToL3) && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Escalate</h3>
                <div className="flex gap-2">
                  {canEscalateToL2 && (
                    <button
                      onClick={() => patchTicket({ escalationLevel: 2 })}
                      disabled={updating}
                      className="px-4 py-2 bg-orange-500 text-white rounded-md text-sm hover:bg-orange-600 disabled:opacity-50"
                    >
                      Escalate to Level 2
                    </button>
                  )}
                  {canEscalateToL3 && (
                    <button
                      onClick={() => patchTicket({ escalationLevel: 3 })}
                      disabled={updating}
                      className="px-4 py-2 bg-red-500 text-white rounded-md text-sm hover:bg-red-600 disabled:opacity-50"
                    >
                      Escalate to Level 3
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Updates / Comments */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Updates</h3>

          {comments.length === 0 ? (
            <p className="text-gray-400 text-sm mb-4">No updates yet.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg p-4 ${c.isSystem ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {c.isSystem ? (
                      <span className="text-sm font-semibold text-yellow-700">System</span>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-gray-900">
                          {c.author?.displayName ?? "Unknown"}
                        </span>
                        {c.author && (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${roleBadgeColors[c.author.role] || "bg-gray-100 text-gray-700"}`}
                          >
                            {roleLabels[c.author.role] || c.author.role}
                          </span>
                        )}
                      </>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Post comment form — hidden on closed tickets */}
          {!isClosed && (
            <form onSubmit={postComment} className="space-y-2">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write an update..."
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-black placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={postingComment || !commentBody.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {postingComment ? "Posting..." : "Post Update"}
              </button>
            </form>
          )}
        </div>

        {/* Log Requests */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Log Requests</h3>
          {ticket.logRequests.length === 0 ? (
            <p className="text-gray-400 text-sm">No log requests yet.</p>
          ) : (
            <div className="space-y-2">
              {ticket.logRequests.map((lr) => (
                <LogRequestItem key={lr.id} logRequest={lr} />
              ))}
            </div>
          )}

          {/* Request Logs button — staff only */}
          {!isClient && !isClosed && (
            <div className="mt-3">
              {showLogForm ? (
                <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-purple-900 mb-2">
                    Select log types to collect from {ticket.clientMachine}
                  </h4>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {["Application", "System", "Security", "Setup"].map((lt) => (
                      <label key={lt} className="flex items-center gap-1.5 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedLogTypes.includes(lt)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLogTypes((prev) => [...prev, lt]);
                            } else {
                              setSelectedLogTypes((prev) => prev.filter((t) => t !== lt));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        {lt}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (selectedLogTypes.length === 0) return;
                        setRequestingLogs(true);
                        const res = await fetch(`/api/tickets/${id}/log-requests`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ logTypes: selectedLogTypes }),
                        });
                        if (res.ok) {
                          // Refresh ticket data
                          const full = await fetch(`/api/tickets/${id}`);
                          if (full.ok) setTicket(await full.json());
                          // Refresh comments
                          const commentsRes = await fetch(`/api/tickets/${id}/comments`);
                          if (commentsRes.ok) setComments(await commentsRes.json());
                          setShowLogForm(false);
                          setSelectedLogTypes([]);
                        }
                        setRequestingLogs(false);
                      }}
                      disabled={requestingLogs || selectedLogTypes.length === 0}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 disabled:opacity-50"
                    >
                      {requestingLogs ? "Requesting..." : "Submit Request"}
                    </button>
                    <button
                      onClick={() => {
                        setShowLogForm(false);
                        setSelectedLogTypes([]);
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowLogForm(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700"
                >
                  Request Logs
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Log Request Item ─────────────────────────────────────────

const logStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

function LogRequestItem({
  logRequest,
}: {
  logRequest: Ticket["logRequests"][number];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-50 rounded p-3 text-sm">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{logRequest.logType}</span>
          <span
            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${logStatusColors[logRequest.status] || "bg-gray-100"}`}
          >
            {logRequest.status.replace(/_/g, " ")}
          </span>
          <span className="text-gray-500">{logRequest.logEntries.length} entries</span>
        </div>
        <span className="text-gray-400 text-xs">
          {expanded ? "collapse" : "expand"}
        </span>
      </div>
      {expanded && logRequest.logEntries.length > 0 && (
        <div className="mt-3 max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-200">
              <tr>
                <th className="text-left px-2 py-1">Time</th>
                <th className="text-left px-2 py-1">Event ID</th>
                <th className="text-left px-2 py-1">Level</th>
                <th className="text-left px-2 py-1">Source</th>
                <th className="text-left px-2 py-1">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logRequest.logEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-100">
                  <td className="px-2 py-1 whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-2 py-1">{entry.eventId}</td>
                  <td className="px-2 py-1">{entry.level}</td>
                  <td className="px-2 py-1">{entry.source}</td>
                  <td className="px-2 py-1 max-w-md truncate" title={entry.message}>
                    {entry.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {expanded && logRequest.logEntries.length === 0 && (
        <p className="mt-2 text-gray-400 text-xs">
          {logRequest.status === "FAILED"
            ? "Collection failed."
            : "No entries yet — waiting for agent."}
        </p>
      )}
    </div>
  );
}
