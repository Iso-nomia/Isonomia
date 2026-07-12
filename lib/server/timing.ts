export function since(t0 = performance.now()) {
    return () => Math.round((performance.now() - t0));
  }
  
  export function addServerTiming(res: Response, entries: Array<{name: string; durMs: number}>) {
    const header = entries.map(e => `${e.name};dur=${Math.round(e.durMs)}`).join(', ');
    res.headers.set('Server-Timing', header);
  }
  