// app/passport/page.tsx
export default function PassportPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Passport</h1>
      <p>Download exports and verify signatures & hashes.</p>
      <ul className="list-disc list-inside">
        <li><a href="/passport/verifier">Web verifier</a></li>
        <li><a href="https://github.com/yourorg/mesh-lite">Mesh‑Lite</a></li>
      </ul>
    </div>
  );
}
