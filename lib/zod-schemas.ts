import { z } from 'zod';

/** What the React form captures (dollars) */
export const ItemFormSchema = z.object({
  name:        z.string().min(3),
  description: z.string().min(3),
  price:       z.coerce.number().min(0.5),   // dollars in the UI
  stock:       z.number().int().min(1),
  images:      z.array(z.string()).min(1),
});
export type ItemForm = z.infer<typeof ItemFormSchema>;

/** What the API route expects (adds price_cents) */
export const ItemSchema = ItemFormSchema.transform((v) => ({
  ...v,
  price_cents: Math.round(v.price * 100),
}));
export type ItemPayload = z.infer<typeof ItemSchema>;
