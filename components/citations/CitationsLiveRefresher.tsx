// components/citations/CitationsLiveRefresher.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CitationsLiveRefresher() {
  const router = useRouter();
  useEffect(() => {
    const h = () => router.refresh();
    window.addEventListener('citations:changed', h as any);
    return () => window.removeEventListener('citations:changed', h as any);
  }, [router]);
  return null;
}
