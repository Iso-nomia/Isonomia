// app/(dashboard)/components/CostEstimate.tsx
'use client';

export function CostEstimate({ dbGB = 5, s3GB = 5, shards = 1 }: { dbGB?: number; s3GB?: number; shards?: number }) {
  // very rough: db $0.115/GB, s3 $0.023/GB, shard keys $1/mo
  const monthly = dbGB*0.115 + s3GB*0.023 + shards*1.0;
  return <div className="text-sm text-gray-600">Est. monthly: ${monthly.toFixed(2)} (rough)</div>;
}
