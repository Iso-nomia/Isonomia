"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface AccountData {
  displayName?: string;
  handle?: string;
  bio?: string;
  photoUrl?: string;
}

export default function AccountForm({ initial }: { initial: AccountData }) {
  const [form, setForm] = useState<AccountData>(initial);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const handle = setTimeout(async () => {
      const resp = await fetch("/api/settings/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: form }),
      });
      if (resp.ok) toast.success("Saved");
    }, 750);
    return () => clearTimeout(handle);
  }, [form]);

  function onChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setForm((f) => ({ ...f, photoUrl: url }));
    }
  }

  return (
    <form className="flex flex-col gap-4">
      <input
        aria-label="display name"
        name="displayName"
        value={form.displayName ?? ""}
        onChange={onChange}
        className="textinputfield"
        placeholder="Display name"
      />
      <input
        aria-label="handle"
        name="handle"
        value={form.handle ?? ""}
        onChange={onChange}
        className="textinputfield"
        placeholder="@handle"
      />
      <textarea
        aria-label="bio"
        name="bio"
        value={form.bio ?? ""}
        onChange={onChange}
        className="textinputfield"
        placeholder="Bio"
      />
      <input aria-label="photo" type="file" onChange={onFile} />
    </form>
  );
}
