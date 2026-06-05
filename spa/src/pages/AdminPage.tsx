import { useEffect, useMemo, useState } from "react";
import type { ReactElement, ChangeEvent } from "react";
import { motion } from "framer-motion";
import { getStatusDescription, getStatusLabel, ORDER_STATUS_STEPS } from "../utils/orderStatus";

type HistoryEntry = {
  status: string;
  note?: string | null;
  created_at: string;
};

type DraftPortrait = {
  style: string;
  label: string;
  imageBase64?: string;
  isPlaceholder?: boolean;
};

type AdminOrderSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  styles: string[];
  delivery: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
  draftCount: number;
  hasApproved: boolean;
};

type AdminOrderDetail = AdminOrderSummary & {
  photoBase64?: string | null;
  notes?: string | null;
  photoKey?: string | null;
  photoContentType?: string | null;
  photoSize?: number | null;
  drafts?: DraftPortrait[];
  approved?: DraftPortrait | null;
};

const STATUS_OPTIONS = Object.keys(ORDER_STATUS_STEPS);
const TOKEN_STORAGE_KEY = "admin-token";

function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function AdminPage(): ReactElement {
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
  });
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState<boolean>(false);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [statusDraft, setStatusDraft] = useState<string>("");
  const [detailRefresh, setDetailRefresh] = useState<number>(0);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState<number | null>(null);
  const [approvalNote, setApprovalNote] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);

  useEffect(() => {
    if (!token) {
      setOrders([]);
      setSelectedOrder(null);
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/admin/orders", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: "Unable to load orders." }));
          throw new Error(payload.message ?? "Unable to load orders.");
        }
        const payload = (await response.json()) as { orders: AdminOrderSummary[] };
        if (!cancelled) {
          setOrders(payload.orders);
          if (payload.orders.length) {
            setSelectedId(payload.orders[0].id);
          } else {
            setSelectedId(null);
            setSelectedOrder(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load orders.");
          setOrders([]);
          setSelectedOrder(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedId) {
      setSelectedOrder(null);
      return;
    }
    let cancelled = false;
    async function loadDetail() {
      try {
        setDetailLoading(true);
        setDetailError(null);
        const response = await fetch(`/api/admin/orders/${selectedId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: "Unable to load order." }));
          throw new Error(payload.message ?? "Unable to load order.");
        }
        const payload = (await response.json()) as { order: AdminOrderDetail };
        if (!cancelled) {
          const normalized: AdminOrderDetail = {
            ...payload.order,
            photoSize: payload.order.photoSize != null ? Number(payload.order.photoSize) : null,
            drafts: Array.isArray(payload.order.drafts) ? payload.order.drafts : [],
            approved: payload.order.approved ?? null,
          };
          setSelectedOrder(normalized);
          setStatusDraft(normalized.status ?? "");
          setNoteDraft(normalized.notes ?? "");
          const drafts = normalized.drafts ?? [];
          if (normalized.approved && drafts.length) {
            const approvedDraft = normalized.approved;
            const matchIndex = drafts.findIndex(
              (draft) =>
                draft.style === approvedDraft.style &&
                draft.label === approvedDraft.label &&
                draft.imageBase64 === approvedDraft.imageBase64,
            );
            setSelectedDraftIndex(matchIndex >= 0 ? matchIndex : null);
          } else {
            setSelectedDraftIndex(drafts.length ? 0 : null);
          }
          setApprovalNote("");
        }
      } catch (err) {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : "Unable to load order.");
          setSelectedOrder(null);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [token, selectedId, detailRefresh]);

  const handleTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    setToken(event.target.value.trim());
  };

  const refreshOrders = async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { orders: AdminOrderSummary[] };
      setOrders(payload.orders);
    } catch (error) {
      console.warn("Refresh orders failed", error);
    }
  };

  const handleStatusSubmit = async () => {
    if (!token || !selectedId || !statusDraft) return;
    try {
      setStatusSubmitting(true);
      const response = await fetch(`/api/admin/orders/${selectedId}/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: statusDraft, note: noteDraft }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Unable to update status." }));
        throw new Error(payload.message ?? "Unable to update status.");
      }
      const payload = await response.json();
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status ?? prev.status,
              history: payload.history ?? prev.history,
              notes: noteDraft || prev.notes,
            }
          : prev,
      );
      setStatusDraft(payload.status ?? statusDraft);
      setNoteDraft("");
      await refreshOrders();
      setStatusSubmitting(false);
    } catch (error) {
      console.error(error);
      setStatusSubmitting(false);
      setDetailError(error instanceof Error ? error.message : "Unable to update status.");
    }
  };

  const handleGenerateDrafts = async () => {
    if (!token || !selectedId) return;
    try {
      setIsGenerating(true);
      setDetailError(null);
      const response = await fetch(`/api/admin/orders/${selectedId}/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Unable to generate drafts." }));
        throw new Error(payload.message ?? "Unable to generate drafts.");
      }
      await refreshOrders();
      setDetailRefresh((prev) => prev + 1);
    } catch (error) {
      console.error(error);
      setDetailError(error instanceof Error ? error.message : "Unable to generate drafts.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveDraft = async () => {
    if (!token || !selectedId) return;
    if (selectedDraftIndex === null) {
      setDetailError("Select a draft to approve.");
      return;
    }
    try {
      setIsApproving(true);
      setDetailError(null);
      const response = await fetch(`/api/admin/orders/${selectedId}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ draftIndex: selectedDraftIndex, note: approvalNote }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Unable to approve artwork." }));
        throw new Error(payload.message ?? "Unable to approve artwork.");
      }
      const payload = await response.json();
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status ?? prev.status,
              approved: payload.approved ?? prev.approved,
            }
          : prev,
      );
      setApprovalNote("");
      await refreshOrders();
      setDetailRefresh((prev) => prev + 1);
    } catch (error) {
      console.error(error);
      setDetailError(error instanceof Error ? error.message : "Unable to approve artwork.");
    } finally {
      setIsApproving(false);
    }
  };

  const selectedHistory = useMemo(() => selectedOrder?.history ?? [], [selectedOrder]);
  const photoPreview = selectedOrder?.photoBase64
    ? `data:${selectedOrder.photoContentType ?? "image/png"};base64,${selectedOrder.photoBase64}`
    : null;
  const drafts = selectedOrder?.drafts ?? [];
  const approvedDraft = selectedOrder?.approved ?? null;
  const selectedDraft = selectedDraftIndex != null ? drafts[selectedDraftIndex] : null;

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 pb-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3 text-center"
      >
        <h1 className="text-4xl font-semibold text-white sm:text-5xl">Studio ops dashboard</h1>
        <p className="text-lg text-slate-300">
          Review submissions, advance statuses, and coordinate production.
        </p>
        <div className="mx-auto flex max-w-xl flex-col gap-2 rounded-3xl border border-white/10 bg-white/5 p-4 text-left">
          <label className="text-sm font-semibold text-slate-200">
            Admin token
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              type="password"
              placeholder="Set ADMIN_TOKEN via wrangler secret"
              value={token}
              onChange={handleTokenChange}
            />
          </label>
          <p className="text-xs text-slate-400">
            This token authenticates API calls to the Worker. Share it only with your production team.
          </p>
        </div>
      </motion.header>

      {error && (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-400/10 p-6 text-center text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-500/20">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Open orders</h2>
            {loading && <span className="text-xs text-slate-300">Loading…</span>}
          </div>
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-sm text-slate-300/80">No orders yet. They’ll appear here once customers submit photos.</p>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selectedId === order.id
                      ? "border-indigo-400/60 bg-indigo-400/10"
                      : "border-white/10 bg-white/5 hover:border-indigo-400/40"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm text-slate-200/90">
                    <span className="font-semibold text-white">{order.firstName || "Customer"} {order.lastName || ""}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wide text-slate-200/70">
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300/70">
                    Styles: {order.styles.join(", ") || "—"}
                  </p>
                  <p className="text-xs text-slate-300/70">
                    Drafts: {order.draftCount} • Approved: {order.hasApproved ? "Yes" : "No"}
                  </p>
                  <p className="text-xs text-slate-300/70">
                    Updated {new Date(order.updatedAt).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-500/10">
          {detailLoading ? (
            <p className="text-sm text-slate-300/80">Loading order details…</p>
          ) : detailError ? (
            <p className="text-sm text-rose-200">{detailError}</p>
          ) : !selectedOrder ? (
            <p className="text-sm text-slate-300/80">Select an order to review the submission.</p>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1 text-sm text-slate-200/80">
                <p className="text-xs uppercase tracking-[0.18em] text-indigo-200">Customer</p>
                <p className="text-base font-semibold text-white">
                  {selectedOrder.firstName || "Customer"} {selectedOrder.lastName || ""}
                </p>
                <p>{selectedOrder.email}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-indigo-200">Styles</p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-200/80">
                  {selectedOrder.styles.length === 0
                    ? "—"
                    : selectedOrder.styles.map((style) => (
                        <span key={style} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          {style}
                        </span>
                      ))}
                </div>
              </div>

              {photoPreview ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-indigo-200">Uploaded photo</p>
                  <img
                    src={photoPreview}
                    alt="Customer submitted pet"
                    className="max-h-64 w-full rounded-2xl border border-white/10 object-contain"
                  />
                  <p className="text-xs text-slate-300/70">
                    {selectedOrder.photoContentType ?? "image/*"} · {formatBytes(selectedOrder.photoSize)}
                  </p>
                </div>
              ) : selectedOrder.photoKey ? (
                <div className="space-y-2 rounded-2xl border border-indigo-400/30 bg-indigo-400/10 p-4 text-xs text-indigo-100">
                  <p className="font-semibold text-white">Photo stored in bucket</p>
                  <p>
                    Use Wrangler or the Cloudflare dashboard to download{' '}
                    <code className="ml-1 rounded bg-indigo-500/20 px-1 py-px text-[0.7rem] text-indigo-50">
                      {selectedOrder.photoKey}
                    </code>
                    .
                  </p>
                  <p className="text-indigo-200/80">
                    {selectedOrder.photoContentType ?? "image/*"} · {formatBytes(selectedOrder.photoSize)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-300/70">No photo on file yet.</p>
              )}

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs uppercase tracking-[0.18em] text-indigo-200">Draft generation</p>
                  <button
                    type="button"
                    onClick={handleGenerateDrafts}
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isGenerating
                      ? "Generating…"
                      : drafts.length
                        ? "Regenerate drafts"
                        : "Generate drafts"}
                  </button>
                </div>
                <p className="text-sm text-slate-300/80">
                  We’ll render one draft per style. Placeholders appear if the model is unavailable.
                </p>
                {drafts.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-300/70">
                    No drafts generated yet. Trigger generation once the pet photo is verified.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {drafts.map((draft, index) => {
                      const isSelected = selectedDraftIndex === index;
                      const previewSrc = draft.imageBase64
                        ? `data:image/png;base64,${draft.imageBase64}`
                        : null;
                      return (
                        <button
                          type="button"
                          key={`${draft.style}-${index}`}
                          onClick={() => setSelectedDraftIndex(index)}
                          className={`flex h-full flex-col rounded-2xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? "border-emerald-400/70 bg-emerald-400/10"
                              : "border-white/10 bg-white/5 hover:border-indigo-400/40"
                          }`}
                        >
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                            {draft.label}
                          </span>
                          {previewSrc ? (
                            <img
                              src={previewSrc}
                              alt={`${draft.label} preview`}
                              className="mt-3 h-32 w-full rounded-xl object-cover"
                            />
                          ) : (
                            <div className="mt-3 flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-900/40 text-xs text-slate-300/70">
                              Preview unavailable
                            </div>
                          )}
                          {draft.isPlaceholder ? (
                            <span className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                              Placeholder
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}

                {approvedDraft ? (
                  <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Approved draft</p>
                    <p className="mt-1 text-sm text-emerald-50">{approvedDraft.label}</p>
                    {approvedDraft.imageBase64 ? (
                      <img
                        src={`data:image/png;base64,${approvedDraft.imageBase64}`}
                        alt="Approved draft"
                        className="mt-3 h-32 w-full rounded-xl object-cover"
                      />
                    ) : null}
                  </div>
                ) : null}

                {drafts.length > 0 && (
                  <div className="space-y-2">
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                      Approval note (optional)
                      <textarea
                        className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                        value={approvalNote}
                        onChange={(event) => setApprovalNote(event.target.value)}
                        placeholder="Add context for delivery email or production"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleApproveDraft}
                      disabled={isApproving || selectedDraftIndex === null}
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isApproving ? "Approving…" : selectedDraft ? `Approve ${selectedDraft.label}` : "Select a draft"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="grid gap-1 text-sm font-semibold text-slate-200">
                  Update status
                  <select
                    className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                  >
                    <option value="">Select…</option>
                    {STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {getStatusLabel(statusOption)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-200">
                  Internal note (optional)
                  <textarea
                    className="min-h-[80px] rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleStatusSubmit}
                  disabled={statusSubmitting || !statusDraft}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {statusSubmitting ? "Updating…" : "Save status"}
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-indigo-200">Timeline</p>
                <ol className="space-y-2 text-sm text-slate-200/80">
                  {selectedHistory.length === 0 ? (
                    <li>No activity recorded yet.</li>
                  ) : (
                    selectedHistory.map((entry) => (
                      <li key={`${entry.status}-${entry.created_at}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <span className="text-xs uppercase tracking-[0.18em] text-indigo-200">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                        <div className="font-semibold text-white">{getStatusLabel(entry.status)}</div>
                        <div className="text-slate-300/80">
                          {entry.note ?? getStatusDescription(entry.status)}
                        </div>
                      </li>
                    ))
                  )}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
