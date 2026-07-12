// components/stack/StackDiscussion.tsx
// Server component: renders comments inline beneath the stack (with citations)
import Image from "next/image";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import LiftToDebateButton from "./LiftToDebateButton";
import CommentComposer from "./CommentComposer";
import OpenInDiscussionsButton from "../common/OpenInDiscussionsButton";

function commentSnippet(raw: string, max = 96) {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const atWord = cut.lastIndexOf(" ");
  return (atWord > 40 ? cut.slice(0, atWord) : cut).trim() + "…";
}


function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

// small inline formatter; you also have /api/citations/format for batch
function formatCasualChip(s: any, locator?: string | null) {
  const base =
    (typeof s.title === "string" && s.title.trim()) ||
    (typeof s.url === "string" && s.url.replace(/^https?:\/\//, "").slice(0, 80)) ||
    "Source";
  return locator ? `${base} · ${locator}` : base;
}

export default async function StackDiscussion({
  feedPostId,
}: {
  feedPostId: number | bigint;
}) {
  const rootId = BigInt(feedPostId);

  const root = await prisma.feedPost.findUnique({
    where: { id: rootId },
    select: { id: true, stack_id: true, isPublic: true },
  });
  if (!root) return null;

  // 1) Comments
  const comments = await prisma.feedPost.findMany({
    where: { parent_id: rootId },
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      content: true,
      created_at: true,
      author: { select: { id: true, name: true, image: true } },
    },
  });

  // 2) Citations (if any) — targetType:'comment'
  const commentIds = comments.map((c) => c.id.toString());
  const citations = commentIds.length
    ? await prisma.citation.findMany({
        where: { targetType: "comment", targetId: { in: commentIds } },
        include: { source: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const citesByComment = new Map<string, typeof citations>();
  for (const cit of citations) {
    const key = String(cit.targetId);
    const arr = citesByComment.get(key) ?? [];
    arr.push(cit);
    citesByComment.set(key, arr);
  }

  const viewer = await getUserFromCookies();

  return (
    <div className="flex flex-col mt-1 space-y-4">
      {/* Composer */}
      {viewer ? (
        <CommentComposer rootId={rootId.toString()} />
      ) : (
        <div className="text-sm text-muted-foreground">
          Sign in to join the discussion.
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        <hr className="border-slate-500/50 mt-2 mb-2" />
        {comments.map((c) => {
          if (!c.content) return null;
         const titleForDiscussion = `Thread for: ${commentSnippet(c.content, 96)}`;

          const cCites = citesByComment.get(c.id.toString()) ?? [];
          return (
            <div key={c.id.toString()} className="flex gap-3">
              <div className="h-8 w-8 rounded-full overflow-hidden border shrink-0">
                <Image
                  src={c.author?.image || "/assets/user-helsinki.svg"}
                  alt={c.author?.name || "User"}
                  width={32}
                  height={32}
                  className="object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="text-sm">
                  <span className="font-medium">
                    {c.author?.name || "User"}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                <div className="text-sm whitespace-pre-wrap mt-1">
                  {c.content}
                </div>

                {/* Citations */}
                {!!cCites.length && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cCites.map((x) => (
                      <a
                        key={x.id}
                        href={x.source.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] px-1.5 py-0.5 rounded-md border border-indigo-300 bg-white/50 hover:bg-slate-50"
                        title={
                          x.quote ||
                          x.note ||
                          x.source.title ||
                          x.source.url ||
                          ""
                        }
                      >
                        {formatCasualChip(x.source, x.locator)}
                      </a>
                    ))}
                  </div>
                )}
                {/* do not need these buttons under every comment -- only one set of these action buttons per stack  */}
                  {/* <LiftToDebateButton  commentId={c.id.toString()} hostType="stack" hostId={root.stack_id!} />
                  <OpenInDiscussionsButton
  attachedToType="comment"
  attachedToId={String(c.id)}
    title={titleForDiscussion}   // ✅ exact comment text, truncated

  selectExisting
/> */}
              </div>
            </div>
          );
        })}
        {comments.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Be the first to comment.
          </div>
        )}
      </div>
    </div>
  );
}
