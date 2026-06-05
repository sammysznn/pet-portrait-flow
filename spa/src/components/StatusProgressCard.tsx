import type { CSSProperties, ReactElement, ReactNode } from "react";

interface StatusProgressCardProps {
  title: string;
  statusLabel: string;
  progress: number;
  description: ReactNode;
  icon?: ReactNode;
  valueLabel?: string;
}

export function StatusProgressCard({
  title,
  statusLabel,
  progress,
  description,
  icon,
  valueLabel,
}: StatusProgressCardProps): ReactElement {
  const normalized = Math.min(100, Math.max(0, progress));
  const angle = normalized * 3.6;
  const dialStyle: CSSProperties = {
    background: `conic-gradient(#6366f1 ${angle}deg, rgba(148, 163, 184, 0.15) ${angle}deg)`
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-2xl shadow-indigo-500/10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-100">
            {icon}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">{title}</p>
            <p className="text-xl font-semibold text-white">{statusLabel}</p>
          </div>
        </div>
        <div className="relative h-24 w-24">
          <div
            className="absolute inset-0 rounded-full border border-white/10"
            style={dialStyle}
          />
          <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-slate-950/90">
            <span className="text-xl font-semibold text-white">{Math.round(normalized)}%</span>
            {valueLabel ? <span className="text-[0.65rem] uppercase tracking-[0.2em] text-indigo-200">{valueLabel}</span> : null}
          </div>
        </div>
      </div>
      <div className="mt-4 text-sm text-slate-200/80">{description}</div>
    </div>
  );
}
