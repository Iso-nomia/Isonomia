"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewArtifactButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setCreating(false);
        return;
      }
      const data = await res.json();
      router.push(`/compose/${data.artifact.id}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={create}
      disabled={creating}
      className="font-sans text-sm text-amber-700 hover:underline disabled:text-stone-400"
    >
      {creating ? "Creating…" : "+ New artifact"}
    </button>
  );
}
