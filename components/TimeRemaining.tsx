"use client";

import { useEffect, useState } from "react";
import { intervalToDuration, formatDuration } from "date-fns";

// components/TimeRemaining.tsx
export interface TimeRemainingProps {
    closesAt: Date | string | undefined;
  }

const TimeRemaining: React.FC<TimeRemainingProps> = ({ closesAt }) => {
  const [now, setNow] = useState<Date>();      // undefined on server → no markup

  const target = typeof closesAt === "string"
  ? new Date(closesAt)
  : closesAt ?? new Date();

  useEffect(() => {
    setNow(new Date());                        // first paint in the browser
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;                       // nothing rendered server-side

  const dur = intervalToDuration({ start: now, end: target });
  const text = formatDuration(dur, { format: ["minutes", "seconds"] });
  return <span>{text}</span>;
};

export default TimeRemaining;
