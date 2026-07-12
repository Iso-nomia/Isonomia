"use client";
import { useEffect, useState } from "react";

export function usePartyPresence(partyId: string) {
  const [cursors, setCursors] = useState<
    { userId: string; x: number; y: number }[]
  >([]);
  useEffect(() => {
    const es = new EventSource(`/api/party/${partyId}/events`);
    es.onmessage = (e) => setCursors(JSON.parse(e.data).cursors);
    return () => es.close();
  }, [partyId]);
  return cursors;
}
