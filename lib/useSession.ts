// lib/useSession.ts
"use client";
import { useEffect, useState } from "react";

interface Session {
  userId: number | null;
  email?: string | null;
  photoURL?: string | null;
  // …add whatever shape your `/api/me` returns
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled) {
          setSession(data);
          setLoading(false);
        }
      })
      .catch(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading };
}
