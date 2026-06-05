import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { FormEvent, ReactElement } from "react";

const DIGITAL_PRICE_CENTS = 499;
const FRAMED_PRICE_CENTS = 2499;
const STORAGE_KEY = "pet-portrait-order";

const PORTRAIT_STYLES = [
  {
    id: "realistic-painted",
    name: "Realistic Painted Portrait 🎨",
    description: "Classic oil and acrylic realism with rich lighting and detail.",
  },
  {
    id: "royal-costume",
    name: "Royal / Costume Portrait 👑",
    description: "Dress your pet like a monarch, general, or renaissance icon.",
  },
  {
    id: "cartoon-pop",
    name: "Cartoon & Pop Art 🐾",
    description: "Bold outlines, neon colors, and playful comic energy.",
  },
  {
    id: "minimalist-line",
    name: "Minimalist Line Art ✍️",
    description: "Elegant single-line illustration for modern spaces.",
  },
  {
    id: "fantasy-whimsical",
    name: "Fantasy & Whimsical 🌌",
    description: "Transform your pet into a magical hero or cosmic explorer.",
  },
] as const;

const DELIVERY_CHOICES = [
  {
    id: "digital",
    name: "Digital download",
    helper: "High-resolution PNG - $4.99 per selected style.",
  },
  {
    id: "framed",
    name: "Framed print",
    helper: '12" x 16" ready-to-hang frame - $24.99 per selected style.',
  },
] as const;

type PortraitStyleId = (typeof PORTRAIT_STYLES)[number]["id"];
type DeliveryId = (typeof DELIVERY_CHOICES)[number]["id"];

type StoredOrder = {
  firstName: string;
  lastName: string;
  email: string;
  styles: PortraitStyleId[];
  delivery: DeliveryId[];
};

const DEFAULT_STYLE_IDS: PortraitStyleId[] = ["realistic-painted"];
const DEFAULT_DELIVERY_IDS: DeliveryId[] = ["digital"];

const initialOrder: StoredOrder = {
  firstName: "",
  lastName: "",
  email: "",
  styles: [...DEFAULT_STYLE_IDS],
  delivery: [...DEFAULT_DELIVERY_IDS],
};

async function createCheckoutSession(body: StoredOrder): Promise<{ url: string }> {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unable to start checkout." }));
    throw new Error(error.message ?? "Unable to start checkout.");
  }

  return response.json();
}

export function OrderPage(): ReactElement {
  const [order, setOrder] = useState<StoredOrder>(() => {
    try {
      const cached = window.sessionStorage.getItem(STORAGE_KEY);
      if (!cached) return initialOrder;
      const parsed = JSON.parse(cached) as Partial<StoredOrder>;
      return {
        ...initialOrder,
        ...parsed,
        styles: parsed.styles?.length ? (parsed.styles as PortraitStyleId[]) : initialOrder.styles,
        delivery: parsed.delivery?.length ? (parsed.delivery as DeliveryId[]) : initialOrder.delivery,
      };
    } catch (error) {
      console.warn("Failed to parse stored order", error);
      return initialOrder;
    }
  });

  const [isSubmitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }, [order]);

  const styleCount = order.styles.length || 1;
  const totals = useMemo(() => {
    const digital = order.delivery.includes("digital") ? DIGITAL_PRICE_CENTS * styleCount : 0;
    const framed = order.delivery.includes("framed") ? FRAMED_PRICE_CENTS * styleCount : 0;
    return {
      digital,
      framed,
      total: digital + framed,
    };
  }, [order.delivery, styleCount]);

  function updateField<T extends keyof StoredOrder>(key: T, value: StoredOrder[T]) {
    setOrder((prev) => ({ ...prev, [key]: value }));
  }

  function toggleItem<T extends PortraitStyleId | DeliveryId>(
    current: readonly T[],
    value: T,
  ): T[] {
    return current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!order.firstName || !order.lastName || !order.email) {
      setStatus("Please enter your name and email.");
      return;
    }

    if (order.styles.length === 0) {
      setStatus("Select at least one portrait style.");
      return;
    }

    if (order.delivery.length === 0) {
      setStatus("Pick at least one delivery format.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await createCheckoutSession(order);
      console.debug("Checkout session redirect", response);
      setStatus("Redirecting to Stripe Checkout...");
      window.location.assign(response.url);
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Unable to start checkout.");
      setSubmitting(false);
    }
  }

  const hasTotals = totals.total > 0;

  useEffect(() => {
    if (window.location.search.includes("canceled")) {
      setStatus("Checkout was canceled - feel free to pick up where you left off.");
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 pb-10">
      <div className="space-y-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="text-balance text-4xl font-semibold text-white sm:text-5xl"
        >
          Customize your portrait package
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: "easeOut" }}
          className="mx-auto max-w-2xl text-lg text-slate-300"
        >
          Choose the art styles you love and decide whether you want a digital download, a framed print, or both.
          You&apos;ll upload your pet photo after checkout.
        </motion.p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-8 rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl lg:grid-cols-[1.6fr_1fr]"
      >
        <div className="space-y-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-left text-sm font-medium text-slate-200">
              First name
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-semibold text-white/90 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                value={order.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                name="firstName"
                autoComplete="given-name"
                required
              />
            </label>
            <label className="grid gap-1 text-left text-sm font-medium text-slate-200">
              Last name
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-semibold text-white/90 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                value={order.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                name="lastName"
                autoComplete="family-name"
                required
              />
            </label>
          </div>
          <label className="grid gap-1 text-left text-sm font-medium text-slate-200">
            Email address
            <input
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-semibold text-white/90 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              value={order.email}
              onChange={(event) => updateField("email", event.target.value)}
              name="email"
              autoComplete="email"
              required
              type="email"
            />
          </label>
          <fieldset className="space-y-4">
            <legend className="text-left text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200">
              Choose your styles
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {PORTRAIT_STYLES.map((style) => {
                const selected = order.styles.includes(style.id);
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => updateField("styles", toggleItem(order.styles, style.id))}
                    className={`group flex h-full flex-col items-start rounded-2xl border bg-white/5 p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${
                      selected
                        ? "border-indigo-400/60 bg-indigo-400/10 shadow-lg shadow-indigo-500/20"
                        : "border-white/5 hover:border-indigo-400/40"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-base font-semibold text-white">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs transition ${
                          selected
                            ? "border-transparent bg-indigo-500 text-white"
                            : "border-white/30 bg-transparent text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      {style.name}
                    </span>
                    <span className="mt-2 text-sm text-slate-300/90">{style.description}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-left text-sm text-slate-400">
              Pick as many styles as you&apos;d like - we generate a unique portrait for each selection.
            </p>
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-left text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200">
              Delivery format
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {DELIVERY_CHOICES.map((option) => {
                const selected = order.delivery.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => updateField("delivery", toggleItem(order.delivery, option.id))}
                    className={`group flex h-full flex-col items-start rounded-2xl border bg-white/5 p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${
                      selected
                        ? "border-emerald-300/60 bg-emerald-400/10 shadow-lg shadow-emerald-500/20"
                        : "border-white/5 hover:border-emerald-300/40"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-base font-semibold text-white">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs transition ${
                          selected
                            ? "border-transparent bg-emerald-400 text-slate-900"
                            : "border-white/30 bg-transparent text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      {option.name}
                    </span>
                    <span className="mt-2 text-sm text-slate-300/90">{option.helper}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-left text-sm text-slate-400">
              Styles and delivery multiply - 2 styles + framed & digital = 4 deliverables.
            </p>
          </fieldset>
        </div>
        <aside className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-inner shadow-slate-950/40">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white/90">Order summary</h2>
            <div className="space-y-3 text-sm text-slate-300/90">
              <div className="flex justify-between">
                <span>Styles</span>
                <span className="font-semibold text-white/90">{order.styles.length}</span>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                {order.styles.map((styleId) => {
                  const style = PORTRAIT_STYLES.find((item) => item.id === styleId);
                  return (
                    <span key={styleId} className="flex items-center gap-2 text-slate-300/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/80" />
                      {style?.name ?? styleId}
                    </span>
                  );
                })}
              </div>
              <div className="h-px rounded bg-white/10" />
              {order.delivery.includes("digital") && (
                <div className="flex justify-between text-sm">
                  <span>Digital</span>
                  <span>${(totals.digital / 100).toFixed(2)}</span>
                </div>
              )}
              {order.delivery.includes("framed") && (
                <div className="flex justify-between text-sm">
                  <span>Framed</span>
                  <span>${(totals.framed / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="h-px rounded bg-white/10" />
              <div className="flex items-center justify-between text-base font-semibold text-white">
                <span>Total today</span>
                <span>{hasTotals ? `$${(totals.total / 100).toFixed(2)}` : "-"}</span>
              </div>
              <p className="text-xs text-slate-400">
                Your card isn&apos;t charged until you complete Stripe Checkout. All prices USD. Taxes & shipping for framed prints calculated at fulfillment.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Redirecting to Stripe..." : "Continue to secure payment"}
            </button>
            {status && (
              <p className="text-sm font-medium text-rose-200/90">{status}</p>
            )}
          </div>
        </aside>
      </form>
    </section>
  );
}
