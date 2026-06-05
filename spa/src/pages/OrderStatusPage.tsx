import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { getStatusDescription, getStatusLabel } from "../utils/orderStatus";
import { StatusProgressCard } from "../components/StatusProgressCard";
import type { ReactElement } from "react";

const STATUS_PROGRESS: Record<string, number> = {
  awaiting_photo: 20,
  pending_review: 40,
  in_production: 60,
  qa_review: 80,
  delivered: 100,
};

type HistoryEntry = {
  status: string;
  note?: string | null;
  created_at: string;
};

type ApprovedPortrait = {
  style: string;
  label: string;
  imageBase64?: string;
  isPlaceholder?: boolean;
};

type OrderStatusResponse = {
  order: {
    id: string;
    status: string;
    styles: string[];
    delivery: string[];
    createdAt: string;
    updatedAt: string;
    history: HistoryEntry[];
    photoSubmitted: boolean;
    draftCount?: number;
    approved?: ApprovedPortrait | null;
  };
};

export function OrderStatusPage(): ReactElement {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId ?? "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderStatusResponse["order"] | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing order identifier.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/order-status?session_id=${encodeURIComponent(sessionId)}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ message: "Unable to fetch order." }));
          throw new Error(payload.message ?? "Unable to fetch order.");
        }
        const payload = (await response.json()) as OrderStatusResponse;
        if (!cancelled) {
          setOrder(payload.order);
        }
      } catch (err) {
        if (!cancelled) {
          setOrder(null);
          setError(err instanceof Error ? err.message : "Unable to fetch order.");
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
  }, [sessionId]);

  const timeline = order?.history ?? [];
  const progressValue = order ? STATUS_PROGRESS[order.status] ?? 10 : 10;
  const approvedPortrait = order?.approved ?? null;
  const approvedImageSrc = approvedPortrait?.imageBase64
    ? `data:image/png;base64,${approvedPortrait.imageBase64}`
    : null;

  const progressDescription = (() => {
    if (!order) return "Track every step of your portrait from upload to delivery.";
    if (!order.photoSubmitted) {
      return "We’re waiting on your pet photo. Upload it from your confirmation email to kick things off.";
    }
    switch (order.status) {
      case "pending_review":
        return "Our team is verifying your photo and preparing it for generation.";
      case "in_production":
        return "AI generation is in motion across the styles you selected.";
      case "qa_review":
        return "We’re polishing the drafts and making sure every detail is perfect.";
      case "delivered":
        return approvedPortrait
          ? "Your royal portrait is ready below. Download it anytime!"
          : "Your portrait is ready. Check your email for the download link.";
      default:
        return getStatusDescription(order.status);
    }
  })();

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 pb-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2 text-center"
      >
        <h1 className="text-4xl font-semibold text-white">Track your portrait order</h1>
        <p className="text-slate-300">
          {sessionId ? `Session ID: ${sessionId}` : "Enter the link from your email to view status updates."}
        </p>
      </motion.header>

      {loading ? (
        <p className="text-center text-slate-300">Loading order status…</p>
      ) : error ? (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-400/10 p-6 text-center text-rose-200">
          {error}
        </div>
      ) : order ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-indigo-500/20"
        >
          <StatusProgressCard
            title="Portrait progress"
            statusLabel={getStatusLabel(order.status)}
            progress={progressValue}
            valueLabel="Complete"
            description={progressDescription}
            icon={<Heart className="h-5 w-5" />}
          />

          <div>
            <h2 className="text-lg font-semibold text-white">Timeline</h2>
            <ol className="mt-4 space-y-3">
              {timeline.map((entry) => (
                <li
                  key={`${entry.status}-${entry.created_at}`}
                  className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  <span className="text-base font-semibold text-white">{getStatusLabel(entry.status)}</span>
                  <span className="text-sm text-slate-300/80">
                    {entry.note ?? getStatusDescription(entry.status)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {approvedImageSrc ? (
            <div className="space-y-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-6 text-left shadow-inner shadow-emerald-500/20">
              <h3 className="text-lg font-semibold text-white">Download your portrait</h3>
              <p className="text-sm text-emerald-50">
                Save the artwork below. We’ve also emailed a copy to the address used at checkout.
              </p>
              <img
                src={approvedImageSrc}
                alt="Approved pet portrait"
                className="max-h-96 w-full rounded-2xl border border-white/20 object-contain"
              />
              <a
                href={approvedImageSrc}
                download={`royal-pet-portrait-${order.id}.png`}
                className="inline-flex w-fit items-center justify-center rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
              >
                Download PNG
              </a>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-slate-200/80">
            <p>
              <span className="font-semibold text-white">Styles:</span> {order.styles.join(", ") || "—"}
            </p>
            <p>
              <span className="font-semibold text-white">Delivery:</span> {order.delivery.join(" · ") || "—"}
            </p>
            <p>
              <span className="font-semibold text-white">Photo received:</span> {order.photoSubmitted ? "Yes" : "Waiting"}
            </p>
            <p>
              <span className="font-semibold text-white">Drafts generated:</span> {order.draftCount ?? 0}
            </p>
          </div>
        </motion.div>
      ) : (
        <p className="text-center text-slate-300">We couldn’t find an order for that link.</p>
      )}
    </section>
  );
}
