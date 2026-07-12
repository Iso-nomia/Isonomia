// app/api/hub/deliberations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  listableDeliberationWhere,
  normalizeUserId,
} from "@/lib/deliberations/visibility";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Candidate window. Stats-based sorts (`claims`/`contested`) are approximate over
// this window — they rank within the most-recently-active rows, not globally.
// Documented in docs/HUB_OVERHAUL_DEV_ROADMAP.md §3.3. Revisit if pagination lands.
const PAGE = 40;
const FACET_SCAN = 300;

type SortKey = "active" | "newest" | "claims" | "contested";

/** Human-readable label for a deliberation whose `title` is null. */
function hostTypeLabel(hostType: string): string {
  const map: Record<string, string> = {
    article: "Article deliberation",
    post: "Post deliberation",
    room_thread: "Room thread",
    library_stack: "Library stack",
    site: "Site deliberation",
    discussion: "Discussion",
    free: "Open deliberation",
    inbox_thread: "Inbox thread",
    work: "Work deliberation",
  };
  return map[hostType] ?? "Deliberation";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const calls = (url.searchParams.get("calls") || "any") as "any" | "open";
  const tags = (url.searchParams.get("tags") || "").split(",").filter(Boolean);
  const sortParam = (url.searchParams.get("sort") || "active") as SortKey;
  const sort: SortKey = ["active", "newest", "claims", "contested"].includes(sortParam)
    ? sortParam
    : "active";

  const userId = normalizeUserId(await getCurrentUserId().catch(() => null));

  // Visibility: public + the viewer's own (created or role-held). See
  // lib/deliberations/visibility.ts.
  const visibility = listableDeliberationWhere(userId);

  // `q` matches the human-readable title and tags as well as ids/host.
  const qFilter: Prisma.DeliberationWhereInput | null = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { tags: { has: q } },
          { id: { contains: q, mode: "insensitive" } },
          { hostId: { contains: q, mode: "insensitive" } },
        ],
      }
    : null;

  const filters: Prisma.DeliberationWhereInput[] = [visibility];
  if (qFilter) filters.push(qFilter);
  if (tags.length) filters.push({ tags: { hasSome: tags } });
  if (calls === "open") filters.push({ calls: { some: {} } });
  const where: Prisma.DeliberationWhereInput = { AND: filters };

  // DB-orderable sorts pick the candidate window directly; stats sorts use the
  // recently-active window and re-rank in memory after aggregation.
  const orderBy: Prisma.DeliberationOrderByWithRelationInput =
    sort === "newest" ? { createdAt: "desc" } : { updatedAt: "desc" };

  const rows = await prisma.deliberation.findMany({
    where,
    orderBy,
    take: PAGE,
    select: {
      id: true,
      title: true,
      hostType: true,
      hostId: true,
      tags: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
      calls: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { description: true, deadline: true },
      },
    },
  });

  // ── Host titles for untitled rows ───────────────────────────────────────────
  // When a deliberation has no title yet, fall back to its host's own name —
  // the article title / library stack name — instead of a generic type label.
  // Batched per host type, keyed by `${hostType}:${hostId}` (distinct id spaces,
  // but composite keeps it unambiguous).
  const untitled = rows.filter((r) => !r.title);
  const articleIds = untitled.filter((r) => r.hostType === "article").map((r) => r.hostId);
  const stackIds = untitled.filter((r) => r.hostType === "library_stack").map((r) => r.hostId);

  const [articles, stacks] = await Promise.all([
    articleIds.length
      ? prisma.article.findMany({
          where: { id: { in: articleIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    stackIds.length
      ? prisma.stack.findMany({
          where: { id: { in: stackIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const hostTitle = new Map<string, string>();
  for (const a of articles) if (a.title) hostTitle.set(`article:${a.id}`, a.title);
  for (const s of stacks) if (s.name) hostTitle.set(`library_stack:${s.id}`, s.name);

  // Drop orphans: untitled article/library_stack rows whose hostId resolves to no
  // live host (seed/test deliberations with synthetic host ids). Titled rows are
  // real content and always kept. Trade-off: the page can return fewer than the
  // 40-row window. See docs/HUB_OVERHAUL_DEV_ROADMAP.md.
  const visibleRows = rows.filter((r) => {
    if (r.title) return true;
    if (r.hostType !== "article" && r.hostType !== "library_stack") return true;
    return hostTitle.has(`${r.hostType}:${r.hostId}`);
  });

  const ids = visibleRows.map((r) => r.id);

  // ── Batched stats (≤2 extra queries regardless of page size) ────────────────
  // 1) claim ids + their deliberation (gives claim counts and the claim→delib map)
  const claims = ids.length
    ? await prisma.claim.findMany({
        where: { deliberationId: { in: ids } },
        select: { id: true, deliberationId: true },
      })
    : [];

  const claimCount = new Map<string, number>();
  const claimToDelib = new Map<string, string>();
  for (const c of claims) {
    claimToDelib.set(c.id, c.deliberationId);
    claimCount.set(c.deliberationId, (claimCount.get(c.deliberationId) ?? 0) + 1);
  }

  // 2) open CQs per claim, summed back to the deliberation
  const openCQByDelib = new Map<string, number>();
  if (claims.length) {
    const grouped = await prisma.cQStatus.groupBy({
      by: ["targetId"],
      where: {
        targetType: "claim",
        targetId: { in: claims.map((c) => c.id) },
        satisfied: false,
      },
      _count: { _all: true },
    });
    for (const g of grouped) {
      const delibId = claimToDelib.get(g.targetId);
      if (!delibId) continue;
      openCQByDelib.set(delibId, (openCQByDelib.get(delibId) ?? 0) + g._count._all);
    }
  }

  let items = visibleRows.map((d) => ({
    id: d.id,
    title: d.title,
    host: { type: d.hostType, id: d.hostId },
    tags: d.tags ?? [],
    visibility: d.visibility,
    call: d.calls[0]
      ? {
          description: d.calls[0].description,
          deadline: d.calls[0].deadline?.toISOString() ?? null,
        }
      : null,
    stats: {
      claims: claimCount.get(d.id) ?? 0,
      openCQs: openCQByDelib.get(d.id) ?? 0,
    },
    label: d.title ?? hostTitle.get(`${d.hostType}:${d.hostId}`) ?? hostTypeLabel(d.hostType),
    updatedAt: d.updatedAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
  }));

  // Stats-based sorts re-rank the candidate window in memory.
  if (sort === "claims") {
    items.sort((a, b) => b.stats.claims - a.stats.claims);
  } else if (sort === "contested") {
    items.sort((a, b) => b.stats.openCQs - a.stats.openCQs);
  }

  // ── Tag facets ──────────────────────────────────────────────────────────────
  // Distinct tags over the listable set (respecting `q`, ignoring the `tags`
  // filter so selecting a chip never empties the picker). Bounded scan.
  const facetRows = await prisma.deliberation.findMany({
    where: { AND: qFilter ? [visibility, qFilter] : [visibility] },
    select: { tags: true },
    take: FACET_SCAN,
  });
  const tagCounts = new Map<string, number>();
  for (const r of facetRows) {
    for (const t of r.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const facetTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return NextResponse.json({
    items,
    facets: { tags: facetTags },
    total: items.length,
  });
}
