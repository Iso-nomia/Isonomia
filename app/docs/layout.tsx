import "@/app/globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Documentation — Isonomia",
    template: "%s — Isonomia docs",
  },
  description:
    "Documentation for Isonomia: architecture, the argument graph, the browser extension, self-hosting, and privacy.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
