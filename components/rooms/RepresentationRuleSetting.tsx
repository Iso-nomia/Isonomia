'use client';
export function RepresentationRuleSetting({ roomId, current }:
  { roomId: string; current: 'utilitarian'|'harmonic'|'maxcov' }) {
  const update = async (rule: 'utilitarian'|'harmonic'|'maxcov') => {
    await fetch(`/api/rooms/${roomId}/settings/representation-rule`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ rule }),
    });
    location.reload();
  };
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Representation rule</div>
      <div className="flex gap-2">
        {(['utilitarian','harmonic','maxcov'] as const).map(r => (
          <button key={r} onClick={() => update(r)}
            className={`px-2 py-1 border rounded ${current===r?'bg-neutral-100':''}`}>
            {r}
          </button>
        ))}
      </div>
      <p className="text-xs text-neutral-600">
        Utilitarian: maximize average coverage · Harmonic: balance fairness · MaxCov: guarantee big groups get a viewpoint (JR‑oriented).
      </p>
    </div>
  );
}
