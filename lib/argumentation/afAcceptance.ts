// lib/argumentation/afAcceptance.ts
import { preferredExtensions } from '@/lib/argumentation';

export function acceptanceLabels(A: string[], R: Array<[string,string]>) {
  const prefs = preferredExtensions(A, new Map(Object.entries(R.reduce((m,[x,y])=>{
    (m[x]??=[]).push(y); return m; }, {} as Record<string,string[]>)).map(([k,arr])=>[k,new Set(arr)])));
  const inAll = new Set<string>(A.filter(a => prefs.every(E => E.has(a))));
  const inSome = new Set<string>(A.filter(a => prefs.some(E => E.has(a))));
  return { scepticalIN: inAll, credulousIN: inSome };
}
