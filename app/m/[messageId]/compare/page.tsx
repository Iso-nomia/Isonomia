import { prisma } from "@/lib/prismaclient";
import { notFound } from "next/navigation";
import { diffWordsHtml } from "@/lib/diff/wordDiff";
import { verifyReceipt } from "@/lib/receipts/verify";

export const dynamic = "force-dynamic";

// helpers near top of component
const fmt = (d: Date | string) =>
  new Date(d).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

const verifiedTip = (state: "valid" | "invalid" | "unknown") =>
  state === "valid" ? "Signature verified"
  : state === "invalid" ? "Signature does not verify"
  : "No public key/secret configured on server";

function snippet(text?: string | null, n = 140) {
  if (!text) return "";
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export async function generateMetadata({ params, searchParams }: any) {
  const id = BigInt(params.messageId);
  const v = Number(searchParams?.v || 0);

  const msg = await prisma.message.findUnique({
    where: { id },
    select: { id: true, text: true },
  });
  if (!msg) return {};

  const receipts = await prisma.mergeReceipt.findMany({
    where: { message_id: id },
    orderBy: [{ merged_at: "asc" }, { id: "asc" }],
    select: { version_hash: true },
  });
  const idx = receipts.length
    ? v > 0
      ? Math.min(v, receipts.length) - 1
      : receipts.length - 1
    : -1;

  const title =
    idx >= 0
      ? `Merged v${idx + 1} • message ${String(msg.id)}`
      : `Compare • message ${String(msg.id)}`;

  const desc = msg.text ? snippet(msg.text) : `Merged version ${idx + 1 || "—"}`;

  const base = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://mesh.app";
  const url = `${base}/m/${String(msg.id)}/compare${v ? `?v=${v}` : ""}`;
  const ogImage = `${url}/opengraph-image${v ? `?v=${v}` : ""}`;

  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      type: "article",
      siteName: "Mesh Compare",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function ComparePage({ params, searchParams }: any) {
  const messageId = BigInt(params.messageId);
  const v = Number(searchParams?.v || "0");

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, text: true },
  });
  if (!message) notFound();

  // full history (oldest → newest) including fields needed to rebuild signed body
  const rows = await prisma.mergeReceipt.findMany({
    where: { message_id: messageId },
    orderBy: [{ merged_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      message_id: true,
      version_hash: true,
      merged_at: true,
      merged_by: true,
      signature: true,
      approvals: true,
      blocks: true,
      parents: true,
      policy_id: true,
      prev_receipt_hash: true,
      snapshot: true,
    },
  });

  const pubKey = process.env.MESH_SIGNING_PUBLIC_KEY_PEM || ""; // for ed25519 receipts
  const hmacSecret = process.env.MERGE_SIGNING_SECRET || "";    // for hmac receipts

  const receipts = rows.map((r, i) => {
    // rebuild the exact body we signed in the merge route
    const body = {
      messageId: r.message_id.toString(),
      versionHash: r.version_hash,
      parents: r.parents ?? [],
      mergedBy: r.merged_by.toString(),
      mergedAt: r.merged_at.toISOString(),
      policy: { id: r.policy_id ?? "owner-or-mod@v1", quorum: null, minApprovals: null, timeoutSec: null },
      approvals: r.approvals ?? [],
      blocks: r.blocks ?? [],
      summary: null as string | null,
      prevReceiptHash: r.prev_receipt_hash ?? null,
      snapshot: r.snapshot ?? null,
    };

    const sig = r.signature || "";
    let verified: "valid" | "invalid" | "unknown" = "unknown";
    if (sig.startsWith("ed25519:")) {
      verified = pubKey ? (verifyReceipt(body, sig, pubKey) ? "valid" : "invalid") : "unknown";
    } else if (sig.startsWith("hmac-sha256:")) {
      verified = hmacSecret ? (verifyReceipt(body, sig, undefined, hmacSecret) ? "valid" : "invalid") : "unknown";
    }

    return {
      v: i + 1,
      versionHash: r.version_hash,
      mergedAt: r.merged_at,
      mergedBy: r.merged_by?.toString(),
      signature: r.signature,
      approvals: Array.isArray(r.approvals) ? (r.approvals as any[]).length : 0,
      blocks: Array.isArray(r.blocks) ? (r.blocks as any[]).length : 0,
      snapshot: r.snapshot as any | null,
      verified,
    };
  });

  const activeIndex =
    receipts.length > 0 ? (v > 0 ? Math.min(v, receipts.length) - 1 : receipts.length - 1) : -1;
  const active = activeIndex >= 0 ? receipts[activeIndex] : null;
  const prev = activeIndex > 0 ? receipts[activeIndex - 1] : null;

  // diff only for text snapshots
  let diffHtml: string | null = null;
  if (active?.snapshot?.type === "text" && prev?.snapshot?.type === "text") {
    const a = prev.snapshot.text || "";
    const b = active.snapshot.text || "";
    diffHtml = diffWordsHtml(a, b);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Compare (message {String(message.id)})</h1>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            ins { background: #ecfdf5; text-decoration: none; padding: 0 .15rem; border-radius: .2rem; }
            del { background: #ffe4e6; text-decoration: line-through; padding: 0 .15rem; border-radius: .2rem; }
          `,
        }}
      />

      {receipts.length === 0 ? (
        <div className="text-sm text-slate-600">No merges yet for this message.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* History */}
          <div className="md:col-span-1 rounded border bg-white/70 backdrop-blur p-3">
            <div className="font-medium mb-2">History</div>
            <div className="space-y-1 max-h-[60vh] overflow-auto">
              {[...receipts].reverse().map((r) => {
                const isActive = r.v === (active?.v ?? receipts.length);
                const badge =
                  r.verified === "valid" ? "✅" : r.verified === "invalid" ? "❌" : "？";
                return (
                  <a
                    key={`v-${r.v}`}
                    href={`/m/${encodeURIComponent(String(message.id))}/compare?v=${r.v}`}
                    className={[
                      "block rounded px-2 py-1",
                      isActive ? "bg-indigo-50 text-indigo-900" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="font-medium">v{r.v}</span>
                      <span className="opacity-80">{fmt(r.mergedAt)}</span>
                      <span className="opacity-70 ml-auto">✅ {r.approvals} · ⛔ {r.blocks}</span>
                      <span title={verifiedTip(r.verified)}>{badge}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Receipt + Content / Diff */}
          <div className="md:col-span-2 space-y-4">
            {active && (
              <div className="rounded border p-4">
                <div className="font-medium mb-2">
                  v{active.v} • versionHash {active.versionHash} •{" "}
                  <span className="opacity-70">✅ {active.approvals} · ⛔ {active.blocks}</span>{" "}
                  <span className="ml-2">
                    {active.verified === "valid"
                      ? "✅ verified"
                      : active.verified === "invalid"
                      ? "❌ invalid"
                      : "？ unknown"}
                  </span>
                </div>
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(
                    {
                      v: active.v,
                      versionHash: active.versionHash,
                      mergedAt: active.mergedAt,
                      mergedBy: active.mergedBy,
                      signature: active.signature,
                    },
                    null,
                    2
                  )}
                </pre>

                {/* Snapshot preview */}
                {active.snapshot?.type === "facet" ? (
                  <div className="mt-2 text-[12px] text-slate-600">
                    Facet snapshot stored (structured). Rendering of facet bodies can be added here.
                  </div>
                ) : null}
              </div>
            )}

            {/* Diff for text snapshots */}
            {diffHtml && (
              <div className="rounded border p-4">
                <div className="font-medium mb-2">
                  Diff (v{Math.max(1, activeIndex)} → v{activeIndex + 1})
                </div>
                <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: diffHtml }} />
              </div>
            )}

            {/* Current content */}
            <div className="rounded border p-4">
              <div className="font-medium mb-2">Current content</div>
              {message.text ? (
                <div className="prose">{message.text}</div>
              ) : (
                <div className="text-sm text-slate-600">(structured content)</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
