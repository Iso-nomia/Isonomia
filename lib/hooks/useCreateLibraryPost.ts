"use client";

// NOTE: This is a thin client stub. Wire it to your upload/import pipeline next.
// export function useCreateLibraryPost() {
//   return async function createLibraryPost(input: { files?: File[]; urls?: string[] }) {
//     // TODO: Option A (now): call /api/library/import with { externalUrls: urls }
//     // TODO: Option B: upload files to Supabase; pass storage keys to /api/library/import
//     const res = await fetch("/api/library/import", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ externalUrls: input.urls || [], filesCount: input.files?.length || 0 })
//     });
//     if (!res.ok) throw new Error("Library import failed");
//     return res.json();
//   };
// }
type CreateLibraryResult = {
  postIds: string[];
  stackId?: string;
  coverUrls?: string[];
};

export function useCreateLibraryPost() {
  return async function createLibraryPost(input: {
    files?: File[];
    urls?: string[];
    previews?: Array<string|null>;
    stackId?: string;
    stackName?: string;
    isPublic?: boolean;
    caption?: string;
  }) {
    if (input.files?.length) {
      const form = new FormData();
      input.files.forEach(f => form.append("files", f));
      form.append("previews", JSON.stringify(input.previews ?? [])); // 👈 always
      if (input.stackId)  form.append("stackId", input.stackId);
      if (input.stackName) form.append("stackName", input.stackName);
      form.append("isPublic", String(!!input.isPublic));
      if (input.caption) form.append("caption", input.caption);

      const res = await fetch("/api/library/upload", { method: "POST", body: form, credentials: "include" });
      let payload: any = null; try { payload = await res.json(); } catch {}
      if (!res.ok) throw new Error(payload?.error || res.statusText);
      return payload;
    }

    if (input.urls?.length) {
      const res = await fetch("/api/library/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),   // contains urls + previews[]
      });
      let payload: any = null; try { payload = await res.json(); } catch {}
      if (!res.ok) throw new Error(payload?.error || res.statusText);
      return payload;
    }

    throw new Error("No files or URLs provided");
  };
}