"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

export default function EditorStyleGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isNew =
    pathname === "/article/new" || pathname?.endsWith("/article/new");

  // Styles:
  // - "bootstrap" (new): transparent bg so your page gradient shows, no margins, no double scrolling
  // - "editing" (everything else): your existing slate background and spacing
  const cls = isNew
    ? "min-h-screen h-full w-full overflow-hidden bg-transparent"
    : "justify-center items-center align-center mt-9 p-4 h-full w-full overflow-auto bg-slate-300";

  return (
    <div data-editor-screen={isNew ? "bootstrap" : "editing"} className={cls}>
      {children}
    </div>
  );
}


