"use client";

import * as React from "react";

export interface ChipProps {
  chip?: { en: string; es: string };
}

function getLocale() {
  if (typeof window === "undefined") return "en";
  const i18n = (window as any).i18next?.language || (window as any).__nextIntlLocale;
  if (typeof i18n === "string" && i18n.startsWith("es")) return "es";
  return "en";
}

export default function Chip({ chip }: ChipProps) {
  if (!chip) return null;
  const locale = getLocale();
  const text = locale === "es" ? chip.es : chip.en;
  return (
    <span className="px-2 py-1 rounded-full text-xs" style={{ background: "var(--color-secondary)" }}>
      {text}
    </span>
  );
}
