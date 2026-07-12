import { ItemForm } from '@/lib/zod-schemas';

export async function createItem(stallId: string, data: ItemForm) {
  const payload = {
    ...data,
    price_cents: Math.round(data.price * 100),
    // DO NOT add stallId here
  };

  const res = await fetch(`/api/stalls/${stallId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Item create failed');
}
