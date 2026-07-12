// lib/hooks/useSession.ts
"use client";

import { useEffect, useState } from "react";

export interface Session {
  userId: bigint;          // or number/string once JSON‑safe
  email:  string | null;
  name:   string | null;
  // …any other fields you expose
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/me")               // <-- see next section
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active) setSession(data); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  return { session, loading };
}
