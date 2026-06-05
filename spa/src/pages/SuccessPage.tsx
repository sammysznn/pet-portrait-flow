import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import type { ChangeEvent, FormEvent, ReactElement } from "react";
import { getStatusDescription, getStatusLabel } from "../utils/orderStatus";

const STYLE_LIBRARY = {
  "realistic-painted": {
    label: "Realistic Painted Portrait 🎨",
    blurb: "Grand oil painting energy with dramatic lighting and texture.",
  },
  "royal-costume": {
    label: "Royal / Costume Portrait 👑",
    blurb: "Dress your pet like nobility, commanders, or folklore legends.",
  },
  "cartoon-pop": {
    label: "Cartoon & Pop Art 🐾",
    blurb: "Bold colors, playful outlines, graphic comic vibes.",
  },
  "minimalist-line": {
    label: "Minimalist Line Art ✍️",
    blurb: "Clean single-line illustration - understated & modern.",
  },
  "fantasy-whimsical": {
    label: "Fantasy & Whimsical 🌌",
    blurb: "Magical realms, cosmic settings, legendary adventures.",
  },
} as const;

type StyleId = keyof typeof STYLE_LIBRARY;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_MB = 15;

type SessionDetails = {
  paid: boolean;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  styles: StyleId[];
  styleLabels?: string[];
  delivery: string[];
  orderStatus?: string | null;
  orderHistory?: OrderHistoryEntry[];
};

async function fetchSessionStatus(sessionId: string): Promise<SessionDetails> {
  const response = await fetch(`/api/session-status?session_id=${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unable to verify payment." }));
    throw new Error(error.message ?? "Unable to verify payment.");
  }
  const payload = (await response.json()) as SessionDetails;
  return payload;
}
type OrderHistoryEntry = {
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

type OrderStatusPayload = {
  order: {
    id: string;
    status: string;
    styles: StyleId[];
    delivery: string[];
    createdAt: string;
    updatedAt: string;
    history: OrderHistoryEntry[];
    photoSubmitted: boolean;
    draftCount?: number;
    approved?: ApprovedPortrait | null;
  };
};

async function fetchOrderStatus(sessionId: string): Promise<OrderStatusPayload> {
  const response = await fetch(`/api/order-status?session_id=${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unable to load order status." }));
    throw new Error(error.message ?? "Unable to load order status.");
  }
  return response.json();
}

async function submitOrderForReview(formData: FormData): Promise<{ status: string; history: OrderHistoryEntry[] }>
{
  const response = await fetch("/api/order/upload", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unable to submit photo." }));
    throw new Error(error.message ?? "Unable to submit photo.");
  }
  return response.json();
}

export function SuccessPage(): ReactElement {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [session, setSession] = useState<SessionDetails | null>(null);
  const [verifying, setVerifying] = useState<boolean>(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<StyleId[]>([]);
  const [petFile, setPetFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState<boolean>(false);
  const [status, setStatus] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryEntry[]>([]);
  const [photoSubmitted, setPhotoSubmitted] = useState<boolean>(false);
  const [approvedPortrait, setApprovedPortrait] = useState<ApprovedPortrait | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!sessionId) {
      setVerificationError("Missing checkout session ID. Please use the link from your confirmation email.");
      setVerifying(false);
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        setVerifying(true);
        setVerificationError(null);
        const payload = await fetchSessionStatus(sessionId);
        if (cancelled) return;
        if (!payload.paid) {
          throw new Error("We couldn't confirm your payment yet. Refresh in a few seconds or contact support.");
        }
        setSession(payload);
        const validSessionStyles = (payload.styles ?? []).filter((style) => style in STYLE_LIBRARY);
        const fallback: StyleId = "realistic-painted";
        const normalized = validSessionStyles.length ? validSessionStyles : [fallback];
        setSelectedStyles(normalized);
        setOrderStatus(payload.orderStatus ?? null);
        if (payload.orderHistory) {
          setOrderHistory(payload.orderHistory);
        }
        try {
          const order = await fetchOrderStatus(sessionId);
          const orderStyles = order.order?.styles ?? normalized;
          setOrderStatus(order.order?.status ?? null);
          setOrderHistory(order.order?.history ?? []);
          setPhotoSubmitted(order.order?.photoSubmitted ?? false);
          setApprovedPortrait(order.order?.approved ?? null);
          if (orderStyles.length) {
            setSelectedStyles(orderStyles);
          }
        } catch (error) {
          console.warn("Order status lookup failed", error);
        }
      } catch (error) {
        console.error(error);
        setVerificationError(error instanceof Error ? error.message : "Unable to verify payment.");
      } finally {
        if (!cancelled) {
          setVerifying(false);
        }
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!petFile) return;
    const url = URL.createObjectURL(petFile);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return url;
    });
  }, [petFile]);

  const sessionStylesDescription = useMemo(() => {
    if (!session) return "";
    const labels = selectedStyles.map((styleId) => STYLE_LIBRARY[styleId]?.label ?? styleId);
    return labels.join(" · ");
  }, [selectedStyles, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!sessionId || !session?.email) {
      setStatus("Missing session details. Refresh the page or contact support.");
      return;
    }

    if (selectedStyles.length === 0) {
      setStatus("Select at least one style to generate.");
      return;
    }

    if (!petFile) {
      setStatus("Upload the pet photo you want us to transform.");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("petImage", petFile);

      setStatus("Submitting your photo for verification...");
      const result = await submitOrderForReview(formData);
      setOrderStatus(result.status ?? null);
      setOrderHistory(result.history ?? []);
      setPhotoSubmitted(true);
      setStatus("Thanks! Your photo is in the verification queue. We’ll email you with updates.");
      try {
        const refreshed = await fetchOrderStatus(sessionId);
        setOrderStatus(refreshed.order?.status ?? null);
        setOrderHistory(refreshed.order?.history ?? []);
        setPhotoSubmitted(refreshed.order?.photoSubmitted ?? true);
        setApprovedPortrait(refreshed.order?.approved ?? null);
      } catch (error) {
        console.warn("Post-upload status refresh failed", error);
      }
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Unable to submit your photo right now.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPetFile(null);
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus(`Please upload a photo under ${MAX_UPLOAD_MB} MB.`);
      event.target.value = "";
      return;
    }
    setPetFile(file);
  }

  const readyToSubmit = !verifying && !verificationError && !!petFile && selectedStyles.length > 0;
  const statusTimeline = orderHistory ?? [];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 pb-10">
      <div className="space-y-3 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-balance text-4xl font-semibold text-white sm:text-5xl"
        >
          {verificationError ? "We need to confirm your payment" : "Payment confirmed - let's craft your portrait"}
        </motion.h1>
        <p className="text-balance text-lg text-slate-300">
          {verificationError
            ? verificationError
            : verifying
              ? "Checking your Stripe session..."
              : "Upload your pet's photo and keep the styles you want us to generate right now."}
        </p>
        {!verificationError && !verifying && orderStatus && (
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
            Current status: {getStatusLabel(orderStatus)}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-8 rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl lg:grid-cols-[1.5fr_1fr]"
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-left text-sm text-slate-300">
            <p>
              <span className="font-semibold text-white/90">Styles selected:</span> {sessionStylesDescription || "Loading..."}
            </p>
            {session?.delivery?.length ? (
              <p className="pt-2 text-xs text-slate-400">
                Delivery preference: {session.delivery.join(" · ")}. We&apos;ll email downloads, framed prints follow in a separate timeline.
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <h2 className="text-left text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200">Upload pet photo</h2>
            <div className="rounded-3xl border border-dashed border-indigo-400/40 bg-indigo-400/5 p-6 text-left">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  {petFile ? "Replace photo" : "Upload pet photo"}
                </button>
                <p className="flex-1 text-sm text-slate-300/90">
                  Use a clear, well-lit image. Close-up faces deliver the strongest results. Files stay private and are only used to craft your portrait.
                </p>
              </div>
              {previewUrl && (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <img src={previewUrl} alt="Uploaded pet preview" className="h-64 w-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-left text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200">
              Your portrait styles
            </h2>
            <p className="text-sm text-slate-400">
              These are the styles you purchased during checkout. Our team will work through each of them once your photo is verified.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedStyles.map((styleId) => {
                const data = STYLE_LIBRARY[styleId];
                return (
                  <div
                    key={styleId}
                    className="flex h-full flex-col items-start rounded-2xl border border-indigo-300/60 bg-indigo-400/10 p-5 text-left shadow shadow-indigo-500/30"
                  >
                    <span className="text-base font-semibold text-white/90">{data?.label ?? styleId}</span>
                    {data?.blurb ? (
                      <span className="mt-2 text-sm text-slate-300/80">{data.blurb}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <aside className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-inner shadow-slate-950/40">
          <div className="space-y-4 text-sm text-slate-300/90">
            <h2 className="text-lg font-semibold text-white">Generation checklist</h2>
            <ul className="space-y-2">
              <li className={`flex items-center gap-3 ${session ? "text-emerald-300" : "text-slate-400"}`}>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/40">
                  {session ? "✓" : "1"}
                </span>
                Payment verified
              </li>
              <li className={`flex items-center gap-3 ${petFile ? "text-emerald-300" : "text-slate-400"}`}>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/40">
                  {petFile ? "✓" : "2"}
                </span>
                Photo uploaded
              </li>
              <li className={`flex items-center gap-3 ${selectedStyles.length > 0 ? "text-emerald-300" : "text-slate-400"}`}>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/40">
                  {selectedStyles.length > 0 ? "✓" : "3"}
                </span>
                Styles locked in
              </li>
            </ul>
            <p className="text-xs text-slate-400">
              Keep this tab open - we&apos;ll render previews right here. Approved selects will be emailed automatically.
            </p>
          </div>
          <div className="space-y-3">
            <button
              type="submit"
              disabled={!readyToSubmit || isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Submitting..." : photoSubmitted ? "Update photo" : "Submit for review"}
            </button>
            {status && <p className="text-sm font-medium text-slate-200/90">{status}</p>}
          </div>
        </aside>
      </form>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 text-left shadow-2xl shadow-indigo-500/20"
      >
        <h2 className="text-2xl font-semibold text-white">Order status timeline</h2>
        <div className="space-y-4">
          {statusTimeline.length === 0 ? (
            <p className="text-sm text-slate-300/80">
              Submit your pet photo to kick off verification. Updates will appear here.
            </p>
          ) : (
            <ol className="space-y-3 text-sm text-slate-200/80">
              {statusTimeline.map((entry) => (
                <li
                  key={`${entry.status}-${entry.created_at}`}
                  className="flex flex-col rounded-2xl border border-white/5 bg-white/5 p-4"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  <span className="text-base font-semibold text-white">
                    {getStatusLabel(entry.status)}
                  </span>
                  <span className="text-slate-300/80">
                    {entry.note ?? getStatusDescription(entry.status)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {sessionId && (
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-slate-200/80">
            <p>
              Want to check back later? Bookmark your status link:
            </p>
            <a
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-200"
              href={`/order-status/${encodeURIComponent(sessionId)}`}
            >
              View order status page
            </a>
          </div>
        )}
        {approvedPortrait?.imageBase64 ? (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-6 text-sm text-emerald-100">
            <h2 className="text-lg font-semibold text-white">Your portrait is ready</h2>
            <p className="text-sm text-emerald-50">
              We’ve delivered the artwork to your email. You can also download it here anytime.
            </p>
            <img
              src={`data:image/png;base64,${approvedPortrait.imageBase64}`}
              alt="Approved pet portrait"
              className="mt-4 max-h-96 w-full rounded-2xl border border-white/20 object-contain"
            />
            <a
              href={`data:image/png;base64,${approvedPortrait.imageBase64}`}
              download={`royal-pet-portrait-${sessionId}.png`}
              className="mt-4 inline-flex w-fit items-center justify-center rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
            >
              Download PNG
            </a>
          </div>
        ) : null}
      </motion.section>
    </section>
  );
}
