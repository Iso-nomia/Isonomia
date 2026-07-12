import { prisma } from '@/lib/prismaclient';

export default async function LedgerEvent({ params }: { params: { id: string } }) {
  const evt = await prisma.amplificationEvent.findUnique({ where: { id: params.id }});
  if (!evt) return <div className="p-6">Event not found.</div>;
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-lg font-semibold">Amplification Event</h1>
      <div className="text-sm">Kind: {evt.eventType}</div>
      <div className="text-sm">Reason: {evt.reason}</div>
      <pre className="p-3 bg-neutral-50 border rounded text-xs overflow-auto">
        {JSON.stringify(evt.payload, null, 2)}
      </pre>
      <div className="text-xs text-neutral-600">{evt.createdAt.toISOString()}</div>
    </div>
  );
}
