// components/dialogue/DialogueTargetContext.tsx
'use client';
import * as React from 'react';

export type Target = { type: 'argument'|'claim'|'card'; id: string } | null;

const Ctx = React.createContext<{
  target: Target;
  setTarget: (t: Target) => void;
}>({ target: null, setTarget: () => {} });

export function DialogueTargetProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<Target>(null);

  // Optional: listen for cross-component events
  React.useEffect(() => {
    const onSet = (e: any) => {
      const t = e?.detail;
      if (t && typeof t?.id === 'string' && (t.type === 'argument' || t.type === 'claim' || t.type === 'card')) {
        setTarget(t);
      }
    };
    window.addEventListener('dialogue:target:set', onSet as any);
    return () => window.removeEventListener('dialogue:target:set', onSet as any);
  }, []);

  return <Ctx.Provider value={{ target, setTarget }}>{children}</Ctx.Provider>;
}

export const useDialogueTarget = () => React.useContext(Ctx);
