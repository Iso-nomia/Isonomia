import * as React from 'react';

export function useAsyncButton<T extends any[]>(fn: (...args:T)=>Promise<any>) {
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(async (...args:T) => {
    if (busy) return;
    setBusy(true);
    try { await fn(...args); }
    finally { setBusy(false); }
  }, [busy, fn]);
  return { busy, run };
}


