// lib/nl.ts
export type NLNormalizeRes =
  | { ok:true; kind:'fact'; canonical:string; suggestions:string[]; confidence:number }
  | { ok:true; kind:'rule'; canonical:string; tokens:{ ifAll:string[]; then:string }; confidence:number }
  | { ok:false; error:any };

export async function normalizeNL(text: string): Promise<NLNormalizeRes> {
  const r = await fetch('/api/nl/normalize', {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ text })
  }).catch(()=>null);
  if (!r || !r.ok) return { ok:false, error:'normalize_failed' } as any;
  return r.json();
}
