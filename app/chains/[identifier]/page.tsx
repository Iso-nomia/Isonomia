import { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Layers, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { CHAIN_PAGE_INCLUDE } from "@/lib/chains/chainInclude";
import { serializeChain } from "@/lib/chains/serializeChain";
import { computeChainExposure } from "@/lib/deliberation/chainExposure";
import PublicChainView, {
  type ChainView,
} from "@/components/chains/PublicChainView";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ identifier: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

function prefersJsonLd(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  const accept = acceptHeader.toLowerCase();
  if (accept.includes("text/html")) return false;
  return (
    accept.includes("application/ld+json") ||
    accept.includes("application/json")
  );
}

function parseFormatParam(
  raw: string | string[] | undefined,
): "jsonld" | "aif" | null {
  const v = (Array.isArray(raw) ? raw[0] : raw || "").toLowerCase();
  if (v === "jsonld" || v === "json-ld" || v === "rich") return "jsonld";
  if (v === "aif") return "aif";
  return null;
}

function parseView(raw: string | string[] | undefined): ChainView {
  const v = (Array.isArray(raw) ? raw[0] : raw || "").toLowerCase();
  if (v === "essay") return "essay";
  if (v === "prose" || v === "brief") return "prose";
  return "thread";
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { identifier } = await params;

  const chain = await prisma.argumentChain.findUnique({
    where: { id: identifier },
    select: {
      name: true,
      description: true,
      chainType: true,
      isPublic: true,
      deliberation: { select: { title: true } },
      _count: { select: { nodes: true } },
    },
  });

  if (!chain || !chain.isPublic) {
    return { title: "Chain not found — Isonomia" };
  }

  const title = chain.name?.slice(0, 80) || "Argument chain";
  const description =
    chain.description?.slice(0, 200) ||
    `An argument chain of ${chain._count.nodes} ${
      chain._count.nodes === 1 ? "argument" : "arguments"
    }${chain.deliberation?.title ? ` in ${chain.deliberation.title}` : ""}.`;

  const canonicalUrl = `${BASE_URL}/chains/${identifier}`;
  const jsonLdUrl = `${BASE_URL}/api/chains/${identifier}/jsonld`;

  return {
    title: `${title} — Isonomia`,
    description,
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: canonicalUrl,
      types: {
        "application/ld+json": `${jsonLdUrl}?format=jsonld`,
      },
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `${title} — Isonomia`,
      description,
      siteName: "Isonomia",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Isonomia`,
      description,
    },
  };
}

export default async function ChainPage({ params, searchParams }: PageProps) {
  const { identifier } = await params;
  const sp = (await searchParams) || {};

  // ---- Content negotiation: machine consumers get JSON-LD ----
  const explicitFormat = parseFormatParam(sp.format);
  if (explicitFormat) {
    redirect(
      `${BASE_URL}/api/chains/${identifier}/jsonld?format=${explicitFormat}`,
    );
  }
  const h = await headers();
  if (prefersJsonLd(h.get("accept"))) {
    redirect(`${BASE_URL}/api/chains/${identifier}/jsonld?format=jsonld`);
  }

  // ---- Load the full chain ----
  const raw = await prisma.argumentChain.findUnique({
    where: { id: identifier },
    include: CHAIN_PAGE_INCLUDE,
  });

  // ---- Visibility: optional viewer; private + not-creator → empty state ----
  let isCreator = false;
  if (raw && !raw.isPublic) {
    try {
      const user = await getUserFromCookies();
      isCreator = !!user?.userId && raw.createdBy === BigInt(user.userId);
    } catch {
      isCreator = false;
    }
  }

  if (!raw || (!raw.isPublic && !isCreator)) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-md mx-auto px-6 py-32 text-center">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 mb-4">
            <Layers className="w-6 h-6 text-slate-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Chain not found
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            This chain is private or doesn&apos;t exist.
          </p>
          <Link
            href={BASE_URL}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            ← Back to Isonomia
          </Link>
        </div>
      </main>
    );
  }

  const chain = serializeChain(raw);

  // ---- Standing / weakest link (degrade gracefully on failure) ----
  let standing: string | null = null;
  let weakestLink: { argumentId: string; reason: string } | null = null;
  try {
    const exposure = await computeChainExposure(raw.deliberationId);
    const projection = exposure?.chains.find((c) => c.id === raw.id);
    standing = projection?.chainStanding ?? null;
    weakestLink = projection?.weakestLink ?? null;
  } catch {
    standing = null;
  }

  const initialView = parseView(sp.view);
  const canonicalUrl = `${BASE_URL}/chains/${identifier}`;

  // ---- JSON-LD (inline) ----
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Collection",
    "@id": canonicalUrl,
    url: canonicalUrl,
    name: chain.name,
    ...(chain.description ? { description: chain.description } : {}),
    dateCreated: chain.createdAt,
    ...(chain.creator?.name
      ? { author: { "@type": "Person", name: chain.creator.name } }
      : {}),
    numberOfItems: chain.nodes.length,
    hasPart: chain.nodes.map((node, i) => ({
      "@type": "CreativeWork",
      position: i + 1,
      identifier: node.id,
      ...(node.argument?.conclusion?.text
        ? { name: node.argument.conclusion.text.slice(0, 200) }
        : {}),
    })),
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <link
        rel="alternate"
        type="application/ld+json"
        href={`${BASE_URL}/api/chains/${identifier}/jsonld?format=jsonld`}
        title="Schema.org JSON-LD"
      />

      {/* Nav bar */}
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-indigo-300/70">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href={BASE_URL} className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">I</span>
            </div>
            <span className="font-bold text-slate-900 text-[24px] group-hover:text-indigo-600 transition-colors">
              Isonomia
            </span>
          </a>
          <div className="flex items-center gap-4">
            <a
              href={`${BASE_URL}/deliberations/${raw.deliberationId}`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-indigo-600 border-indigo-600 hover:text-indigo-800 hover:bg-slate-100 transition-colors btnv2--ghost"
            >
              View deliberation
            </a>
            <a
              href={`${BASE_URL}/signup`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm text-white bg-indigo-600 hover:bg-indigo-800 transition-all btnv2--ghost"
            >
              Join &amp; respond
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-6 pb-12">
        <PublicChainView
          chain={chain}
          standing={standing}
          weakestLink={weakestLink}
          initialView={initialView}
          baseUrl={BASE_URL}
        />
      </div>
    </main>
  );
}
