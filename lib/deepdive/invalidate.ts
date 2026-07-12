// lib/deepdive/invalidate.ts
import { mutate as globalMutate } from 'swr';

export function invalidateDeliberation(deliberationId: string) {
  globalMutate((key: string) =>
    typeof key === 'string' &&
    key.includes(`/api/deliberations/${deliberationId}/graph`)
  );
}
