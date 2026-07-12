"use client";

import * as React from "react";
import clsx from "clsx";
import HomeButton from "@/components/buttons/HomeButton";

type Tab = "all" | "following" | "calls" | "votes" | "accepted";

export function TopBar({
  tab, onTab, q, onQ, paused, onPause,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  q: string;
  onQ: (s: string) => void;
  paused: boolean;
  onPause: () => void;
}) {
  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "all",       label: "All" },
    { value: "following", label: "Following" },
    { value: "calls",     label: "Calls" },
    { value: "votes",     label: "Votes" },
    { value: "accepted",  label: "Accepted" },
  ];

  return (
    <div className="sticky top-0 z-10 w-full max-w-screen border-b border-b-indigo-300 bg-gradient-to-b from-indigo-50/30 to-slate-100/30 backdrop-blur">
      <div className="flex items-center gap-3 p-3">
        <HomeButton />

        {/* Segmented feed filters (matches your view switcher look/feel) */}
        <Segmented
          value={tab}
          options={tabs}
          onChange={(v) => onTab(v)}
          ariaLabel="Filter feed"
        />

        <div className="ml-auto flex items-center gap-2">
          <input
            className="minorfield w-[260px] rounded-md border border-indigo-100 bg-white/80 px-2 py-1 text-xs focus:outline-none"
            placeholder="Search rooms, claims, sources…"
            value={q}
            onChange={(e) => onQ(e.target.value)}
          />
          <button
            onClick={onPause}
            className={clsx(
              "rounded-md px-3 py-1 text-xs border focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40",
              paused
                ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                : "border-indigo-200 bg-white/80 text-slate-900 hover:bg-slate-100"
            )}
            aria-pressed={paused}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Minimal segmented control (ARIA + arrow-key nav), styled like your view switcher */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  function focusBtn(i: number) {
    const qs = `[data-seg="btn"]`;
    const list = Array.from<HTMLElement>(document.querySelectorAll(qs));
    const next = (i + list.length) % list.length;
    list[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") { e.preventDefault(); focusBtn(idx + 1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); focusBtn(idx - 1); }
  }

  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="ml-2"
    >
      <div className="inline-flex overflow-hidden rounded-xl border border-indigo-300 bg-white/70 text-sm">
        {options.map((o, i) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              data-seg="btn"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={clsx(
                "px-5 py-1 border-r border-indigo-300 last:border-r-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40",
                active ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-slate-100"
              )}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
