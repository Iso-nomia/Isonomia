// components/dashboard/PayoutsPanel.tsx
'use client';
import { useState } from 'react';
import useSWR from 'swr';

export function PayoutsPanel({ stallId }: { stallId: string }) {
  const { data, mutate } = useSWR('/api/stripe/status', (u) => fetch(u).then(r => r.json()));
  const [loading, setLoading] = useState(false);

  const handleOnboard = async () => {
    setLoading(true);
    const r = await fetch('/api/stripe/onboard', { method: 'POST' });
    const { url } = await r.json();
    window.location.href = url;
  };

  return (
    <>
     <h2 className=" text-[1.37rem] font-semibold mb-4">Payouts</h2>

      {data?.charges_enabled ? (
        <p className="text-green-600">Stripe account verified – charges enabled.</p>
      ) : (
        <button className="btn-primary" onClick={handleOnboard} disabled={loading}>
          {loading ? 'Redirecting…' : 'Onboard with Stripe'}
        </button>
      )}
    </>
  );
}
