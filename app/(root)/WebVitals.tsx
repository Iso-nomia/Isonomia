"use client";

import { useEffect } from "react";

function sendToAnalytics(metric: any) {
    fetch("/api/vitals", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metric),
    });
  }

export default function WebVitals() {
  useEffect(() => {
    // Dynamically import so Next skips bundling for the server
    import("web-vitals").then(({ onCLS, onLCP }) => {
        
        onCLS(console.log);
        // You can add the others here, e.g.:
      // onFID(console.log);
       onLCP(console.log);
    });
  }, []);

  return null; // nothing to render
}
