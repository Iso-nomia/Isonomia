'use client';

import { usePartyPresence } from '@/lib/hooks/usePartyPresence';

export default function PartyOverlay({ partyId }: { partyId: string }) {
  const curs = usePartyPresence(partyId) ?? [];            // default to []
  return (
    <>
      {curs.map((c) => {
        // safest: operate with numbers on the client
        const hue = Number(c.userId) % 360;                // 0-359
        return (
          <div
            key={c.userId}
            className="absolute w-4 h-4 rounded-full pointer-events-none"
            style={{
              left: `${c.x}%`,
              top:  `${c.y}%`,
              backgroundColor: `hsl(${hue}deg 70% 50%)`,
            }}
          />
        );
      })}
    </>
  );
}
