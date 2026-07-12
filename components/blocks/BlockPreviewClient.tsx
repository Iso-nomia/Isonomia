"use client";

import React from "react";

export default function BlockPreviewClient({
  component,
  props,
}: {
  component: string;
  props: Record<string, unknown>;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden grid place-items-center text-slate-500 text-xs">
      Block: {String(component)}
    </div>
  );
}
