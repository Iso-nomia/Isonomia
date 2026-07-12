// components/dashboard/OrdersPanel.tsx
'use client';
import useSWR from 'swr';

export function OrdersPanel({ stallId }: { stallId: string }) {
  const { data } = useSWR(`/api/stalls/${stallId}/orders`, (u) => fetch(u).then(r => r.json()));

  return (
    <>
      <h2 className=" text-[1.37rem] font-semibold">Orders</h2>
      {!data ? (
        <p>Loading…</p>
      ) : data.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <table className="min-w-full border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Item</th>
              <th className="px-4 py-2 text-left">Buyer email</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((o: any) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2">{o.item.name}</td>
                <td className="px-4 py-2">{o.buyerEmail}</td>
                <td className="px-4 py-2 text-right">${(o.amount / 100).toFixed(2)}</td>
                <td className="px-4 py-2 text-right">
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
