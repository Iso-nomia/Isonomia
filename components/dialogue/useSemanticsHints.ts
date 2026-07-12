'use client';
import useSWR from 'swr';
const post = (b:any)=>fetch('/api/semantics/hints',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
export function useSemanticsHints(text?: string) {
  const key = text?.trim() ? `sem:hints:${text.slice(0,2000)}` : null;
  const { data, error, isLoading } = useSWR(key, () => post({ text }), { revalidateOnFocus: false });
  return { hints: data?.hints as any, isLoading, error };
}
