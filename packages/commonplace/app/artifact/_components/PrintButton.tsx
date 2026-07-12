"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="font-sans text-xs text-stone-500 hover:text-stone-900"
    >
      Print / PDF
    </button>
  );
}
