// lib/bus.ts
type EventType =
  | 'dialogue:moves:refresh'
  | 'dialogue:cs:refresh'
  | 'claims:edges:changed'
  | 'cards:changed';

type Handler = (payload: any) => void;

type Bus = {
  on: (t: EventType, h: Handler) => () => void;
  emit: (t: EventType, p: any) => void;
  _h: Record<EventType, Set<Handler>>;
};

export const bus: Bus = (globalThis as any).__meshBus__ ??= {
  _h: {} as any,
  on(t: EventType, h: Handler) { (this._h[t] ??= new Set()).add(h); return () => (this._h[t] as Set<Handler>).delete(h); },
  emit(t: EventType, p: any) { for (const h of (this._h[t] ?? [])) try { h(p); } catch {} },
};



// export const bus = {
//     emit(name: string, detail: any) {
//       if (typeof window !== 'undefined') {
//         window.dispatchEvent(new CustomEvent(name, { detail }));
//       }
//     }
//   };
  // make it globally reachable in dev:
  if (typeof globalThis !== 'undefined') (globalThis as any).meshBus = bus;
  
  