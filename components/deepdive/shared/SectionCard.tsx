"use client";
import React from "react";
import clsx from "clsx";

/**
 * SectionCard Component
 * 
 * Extracted from DeepDivePanelV2.tsx (Week 1 - Phase 0)
 * A unified card system for displaying sections with consistent styling
 * 
 * Features:
 * - Title, subtitle, icon support
 * - Action buttons in header
 * - Footer support
 * - Loading states with skeleton
 * - Tone variants (info/success/warn/danger)
 * - Dense/padded modes
 * - Sticky header option
 * - Hover effects with radial gradient
 */

export interface SectionCardProps {
  id?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  dense?: boolean;
  stickyHeader?: boolean;
  busy?: boolean;
  isLoading?: boolean;
  emptyText?: string;
  tone?: "default" | "info" | "success" | "warn" | "danger";
  padded?: boolean;
}

export function SectionCard({
  id,
  title,
  subtitle,
  icon,
  action,
  footer,
  children,
  className = "",
  dense = false,
  stickyHeader = false,
  busy = false,
  isLoading = false,
  emptyText,
  tone = "default",
  padded = true,
}: SectionCardProps) {
  const ringClass =
    tone === "info"
      ? "ring-sky-200/60 dark:ring-sky-400/40"
      : tone === "success"
        ? "ring-emerald-200/60 dark:ring-emerald-400/40"
        : tone === "warn"
          ? "ring-amber-200/60 dark:ring-amber-400/50"
          : tone === "danger"
            ? "ring-rose-200/60 dark:ring-rose-400/40"
            : "ring-slate-200/60 dark:ring-slate-800/60";

  const stripeClass =
    tone === "info"
      ? "bg-sky-400/60"
      : tone === "success"
        ? "bg-emerald-400/60"
        : tone === "warn"
          ? "bg-amber-400/70"
          : tone === "danger"
            ? "bg-rose-400/60"
            : "";

  const bodyPad = padded ? (dense ? "px-3 py-3" : "px-5 pt-4 pb-6") : "";

  return (
    <section
      id={id}
      className={clsx(
        "group relative overflow-hidden rounded-2xl",
        "panel-edge dark:border-slate-800/60",
        "bg-white/50 dark:bg-slate-900/50",
        "backdrop-blur-md supports-[backdrop-filter]:bg-white/50",
        "shadow-sm hover:shadow-md transition-shadow",
        className
      )}
    >
      {/* Busy indicator - animated gradient bar */}
      {busy && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-2xl">
          <div
            className="h-full w-[45%] animate-[mesh-indeterminate_1.6s_infinite_cubic-bezier(0.4,0,0.2,1)]
                       bg-[linear-gradient(90deg,theme(colors.indigo.400),theme(colors.fuchsia.400),theme(colors.sky.400))]"
          />
        </div>
      )}

      {/* Hover ring effect */}
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset",
          ringClass,
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
        )}
        aria-hidden
      />

      {/* Tone indicator stripe */}
      {tone !== "default" && (
        <div
          className={clsx(
            "pointer-events-none absolute left-0 top-0 h-10 w-1.5 rounded-tr-md",
            stripeClass
          )}
          aria-hidden
        />
      )}

      {/* Header with title, subtitle, icon, and action */}
      {(title || action || subtitle || icon) && (
        <div
          onMouseMove={(e) => {
            const t = e.currentTarget as HTMLElement;
            const r = t.getBoundingClientRect();
            t.style.setProperty("--mx", `${e.clientX - r.left}px`);
            t.style.setProperty("--my", `${e.clientY - r.top}px`);
          }}
          className={clsx(
            stickyHeader ? "sticky top-0 z-10 -mx-px px-5 py-3" : "px-5 py-3",
            "flex items-center justify-between gap-3",
            "border-b border-slate-100/80 dark:border-slate-800/70",
            "bg-white/30 dark:bg-slate-900/40 backdrop-blur-md",
            "relative before:pointer-events-none before:absolute before:inset-0",
            "before:bg-[radial-gradient(120px_80px_at_var(--mx)_var(--my),rgba(99,102,241,0.10),transparent_70%)]",
            "before:opacity-0 hover:before:opacity-100 before:transition-opacity"
          )}
        >
          <div className="min-w-0 flex items-center gap-2">
            {icon && (
              <div className="grid size-6 shrink-0 place-items-center rounded-md bg-slate-100 dark:bg-slate-800">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      {/* Body content with optional loading/empty states */}
      <div className={bodyPad}>
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-3/5 rounded bg-slate-200/70 dark:bg-slate-700/60" />
            <div className="h-4 w-full rounded bg-slate-200/70 dark:bg-slate-700/60" />
            <div className="h-4 w-4/5 rounded bg-slate-200/70 dark:bg-slate-700/60" />
          </div>
        ) : emptyText ? (
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Optional footer */}
      {footer && (
        <div className="border-t border-slate-100/80 dark:border-slate-800/70 px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
          {footer}
        </div>
      )}
    </section>
  );
}
