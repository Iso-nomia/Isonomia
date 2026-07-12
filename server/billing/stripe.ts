// server/billing/stripe.ts
export async function reportUsage(roomId: string, dbBytes: number, s3Bytes: number) {
  // TODO: send to Stripe metered billing (usage records)
  return { ok: true, roomId, dbBytes, s3Bytes };
}
