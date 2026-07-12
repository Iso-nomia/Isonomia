import * as React from "react";

export function useMicroToast() {
  const [msg, setMsg] = React.useState<string | null>(null);

  const show = (m: string, ms = 1400) => {
    setMsg(m);
    setTimeout(() => setMsg(null), ms);
  };

  const node = msg ? (
    <div className="fixed bottom-3 right-3 text-xs px-2 py-1 rounded border bg-white shadow">
      {msg}
    </div>
  ) : null;

  return { show, node };
}
