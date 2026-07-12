// components/graph/GraphHeaderValueToggle.tsx
'use client';
export default function ValueToggle({ onChange }:{ onChange:(aud:string|null)=>void }) {
  return (
    <>
    <label className="text-xs inline-flex items-center gap-1">
      Value lens:
      <select className="border rounded px-1 py-0.5"
        onChange={(e)=>onChange(e.target.value || null)}>
        <option value="">Off</option>
        <option value="room:default">Room default</option>
        <option value="user:me">My preferences</option>
      </select>
    </label>
    
    </>
  );
}
