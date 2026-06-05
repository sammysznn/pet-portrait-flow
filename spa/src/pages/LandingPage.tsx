import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import type { ReactElement } from "react";

const heroBlur = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export function LandingPage(): ReactElement {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState("");
  const [trackError, setTrackError] = useState<string | null>(null);

  const handleTrackSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = sessionId.trim();
    if (!trimmed) {
      setTrackError("Enter the session ID from your confirmation email.");
      return;
    }
    setTrackError(null);
    navigate(`/order-status/${encodeURIComponent(trimmed)}`);
  };

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-16 text-center">
      <motion.div
        className="mx-auto max-w-3xl space-y-6"
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.15 }}
      >
        <motion.span
          variants={heroBlur}
          className="inline-flex items-center rounded-full border border-indigo-400/40 bg-indigo-400/10 px-5 py-2 text-sm font-semibold tracking-wide text-indigo-200 backdrop-blur"
        >
          Limited Beta · AI-crafted pet portraits in under 24 hours
        </motion.span>
        <motion.h1
          variants={heroBlur}
          className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          Turn your pet photo into a royal portrait they deserve
        </motion.h1>
        <motion.p
          variants={heroBlur}
          className="text-balance text-lg text-slate-300 sm:text-xl"
        >
          Choose the vibe, pay securely, then upload your pet&apos;s snapshot. We&apos;ll generate museum-worthy art in every style you selected and deliver it within a day.
        </motion.p>
        <motion.div
          variants={heroBlur}
          className="flex flex-col items-center gap-3 pt-4 sm:flex-row sm:justify-center"
        >
          <Link
            to="/order"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-400 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            Start your portrait
          </Link>
          <Link
            to="/order"
            className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-white/10 px-8 py-3 text-base font-semibold text-slate-100 backdrop-blur transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            Explore styles & pricing
          </Link>
        </motion.div>
        <motion.form
          variants={heroBlur}
          onSubmit={handleTrackSubmit}
          className="mx-auto mt-6 flex w-full max-w-md flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-lg shadow-indigo-500/10 backdrop-blur"
        >
          <label className="text-sm font-semibold text-slate-200">
            Already ordered? Track your portrait
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              placeholder="Paste your session ID (cs_test_...)"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              aria-describedby={trackError ? "track-error" : undefined}
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            View order status
          </button>
          {trackError && (
            <p id="track-error" className="text-xs font-semibold text-rose-200">
              {trackError}
            </p>
          )}
        </motion.form>
      </motion.div>
      <motion.div
        className="grid w-full max-w-4xl gap-6 rounded-3xl border border-white/5 bg-white/5 p-8 backdrop-blur-xl sm:grid-cols-2"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
      >
        {[
          {
            title: "Choose your art direction",
            body: "From regal oil paintings to vibrant pop-art, mix and match up to five distinct styles.",
          },
          {
            title: "Secure Stripe checkout",
            body: "Use any card or wallet, stay in test mode until you switch to live keys.",
          },
          {
            title: "Upload after payment",
            body: "We collect the pet photo post-checkout to avoid abandoned carts.",
          },
          {
            title: "Manual QA before delivery",
            body: "Approve drafts in the admin dashboard before we email the final portrait.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-white/5 bg-white/5 p-6 text-left">
            <h3 className="text-lg font-semibold text-white/90">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-200/80">{item.body}</p>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
