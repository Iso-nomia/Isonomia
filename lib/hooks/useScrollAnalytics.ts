import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const schema = z.object({
  user_id: z.string().uuid(),
  session_id: z.string().uuid(),
  pathname: z.string(),
  scroll_pause: z.number(),
  dwell_time: z.number(),
});

export function useScrollAnalytics() {
  const supabaseRef = useRef(
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
  );

  useEffect(() => {
    const sessionKey = "scroll_session_id";
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = uuidv4();
      sessionStorage.setItem(sessionKey, sessionId);
    }

    let lastY = window.scrollY;
    let lastTimestamp = performance.now();
    let throttle = false;

    async function onScroll() {
      const now = performance.now();
      const deltaY = Math.abs(window.scrollY - lastY);
      if (deltaY > 50) {
        const dwell = now - lastTimestamp;
        const user = (await supabaseRef.current.auth.getUser()).data?.user;
        const payload = {
          user_id: user?.id as string,
          session_id: sessionId as string,
          pathname: location.pathname,
          scroll_pause: deltaY,
          dwell_time: Math.round(dwell),
        };
        if (schema.safeParse(payload).success && !throttle) {
          supabaseRef.current.from("scroll_events").insert(payload);
          throttle = true;
          setTimeout(() => {
            throttle = false;
          }, 250);
        }
        lastTimestamp = now;
        lastY = window.scrollY;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}
