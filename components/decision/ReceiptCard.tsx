'use client';
export function ReceiptCard({ receipt }: { receipt: any }) {
  return (
    <div className="rounded border p-2 bg-white text-[12px]">
      <div className="font-medium">{receipt.kind} · {receipt.subjectType}:{receipt.subjectId}</div>
      {receipt.rationale && <div className="text-neutral-700 mt-1">{receipt.rationale}</div>}
      <pre className="mt-2 text-[11px] bg-slate-50 p-2 rounded overflow-x-auto">
        {JSON.stringify(receipt.inputsJson, null, 2)}
      </pre>
      <div className="text-[11px] text-neutral-500 mt-1">v{receipt.version} · {new Date(receipt.createdAt).toLocaleString()}</div>
    </div>
  );
}
