"use client";

import Link from "next/link";

interface DemoCard {
  title: string;
  href: string;
  description: string;
  icon: string;
}

interface DemoCategory {
  name: string;
  description: string;
  demos: DemoCard[];
}

const categories: DemoCategory[] = [
  {
    name: "Platform Features",
    description: "End-to-end demos of major platform systems",
    demos: [
      {
        title: "Article Features",
        href: "/test/article-features",
        description:
          "Editor power, publishing & reading, annotation & deliberation across three phases.",
        icon: "📝",
      },
      {
        title: "Academic Features",
        href: "/test/academic-features",
        description:
          "Paper-to-claim pipeline, debate versioning, forks & merges, provenance & citations.",
        icon: "🎓",
      },
      {
        title: "Stacks Features",
        href: "/test/stacks-features",
        description:
          "Library management, PDF viewer, blocks, citations, source trust & knowledge graph.",
        icon: "📚",
      },
      {
        title: "Messaging Features",
        href: "/test/messaging-features",
        description:
          "Rich messages, layers, drifts & threads, proposals, polls and read receipts.",
        icon: "💬",
      },
      {
        title: "Deliberation Engine",
        href: "/test/deliberation-features",
        description:
          "Core deliberation engine: debate, arguments, chains, graph explorer, dialogical actions & dictionary.",
        icon: "⚖️",
      },
      {
        title: "Living Peer Review",
        href: "/test/living-peer-review",
        description:
          "Public peer review deliberations, argumentation-based reputation & academic credit.",
        icon: "🔬",
      },
      {
        title: "Plexus Features",
        href: "/test/plexus-features",
        description:
          "Cross-deliberation networks, meta-edges, room functors, confidence gating.",
        icon: "🌐",
      },
      {
        title: "Institutional Pathways",
        href: "/test/pathways-features",
        description:
          "Forward deliberation outcomes to institutions, hash-chained packets, dispositions & responses.",
        icon: "🏛️",
      },
    ],
  },
  {
    name: "Argumentation System",
    description: "Argument construction, analysis, and visualization tools",
    demos: [
      {
        title: "Construction Flow",
        href: "/test/construction-flow",
        description:
          "Build arguments step-by-step with attack, support, and general modes.",
        icon: "🏗️",
      },
            {
        title: "AIF Diagrams",
        href: "/test/aif-diagrams",
        description:
          "Argument Interchange Format diagram visualization with Dagre layout.",
        icon: "📊",
      },

      {
        title: "Net Analyzer",
        href: "/test/net-analyzer",
        description:
          "Unified argument analysis with auto net detection, CQs, history & export.",
        icon: "🔍",
      },
      {
        title: "Net CQs",
        href: "/test/net-cqs",
        description:
          "Net composition with critical questions integration and NetGraph visualization.",
        icon: "❓",
      },
      {
        title: "Net Visualization",
        href: "/test/net-visualization",
        description:
          "Explore complex multi-scheme argument nets with interactive graph views.",
        icon: "🕸️",
      },
      {
        title: "Support Flow",
        href: "/test/support-flow",
        description:
          "Guided flow for building support arguments with completion tracking.",
        icon: "🤝",
      },
      {
        title: "Ludics Arena & Game",
        href: "/test/ludics-arena-game",
        description:
          "Faggian-Hyland universal arena and game semantics visualization.",
        icon: "🎲",
      },
    ],
  },
  {
    name: "Scheme Tools",
    description: "Explore, navigate, and select argumentation schemes",
    demos: [
      {
        title: "Scheme Navigator",
        href: "/test/scheme-navigator",
        description:
          "Unified tab-based interface for exploring and selecting argument schemes.",
        icon: "🧭",
      },
      {
        title: "Cluster Browser",
        href: "/test/cluster-browser",
        description:
          "Browse argument schemes by semantic topic clusters and domains.",
        icon: "🗂️",
      },
      {
        title: "Dichotomic Wizard",
        href: "/test/wizard",
        description:
          "Step-by-step wizard for scheme selection via dichotomic tree navigation.",
        icon: "🧙",
      },
      {
        title: "Identification Conditions",
        href: "/test/identification-conditions",
        description:
          "Filter and match arguments to expected schemes with difficulty levels.",
        icon: "🔎",
      },
    ],
  },
  {
    name: "UI Components",
    description: "Standalone component tests and utilities",
    demos: [
      {
        title: "Nested Tabs",
        href: "/test/nested-tabs",
        description:
          "Primary and secondary tab variants for hierarchical navigation.",
        icon: "📑",
      },
      {
        title: "Loading Screen",
        href: "/test/loading-screen",
        description:
          "Deliberation loading screen with configurable host display.",
        icon: "⏳",
      },
    ],
  },
];

export default function DemosNexusPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-slate-900/10">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-400/10 via-cyan-400/10 to-indigo-400/10" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 text-center">
          <h1 className="text-5xl font-bold tracking-wide bg-gradient-to-r from-sky-700 via-cyan-700 to-sky-700 bg-clip-text text-transparent">
            Isonomia Demos Nexus
          </h1>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            Explore interactive demonstrations of every major system and
            subsystem powering the Isonomia platform.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1 border border-slate-900/10 shadow-sm">
              {categories.reduce((n, c) => n + c.demos.length, 0)} demos
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-3 py-1 border border-slate-900/10 shadow-sm">
              {categories.length} categories
            </span>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="mx-auto max-w-7xl px-6 py-12 space-y-16">
        {categories.map((category) => (
          <section key={category.name}>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                {category.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500 ml-4">
                {category.description}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {category.demos.map((demo) => (
                <Link
                  key={demo.href}
                  href={demo.href}
                  className="group relative rounded-xl border border-slate-900/10 bg-white/95 backdrop-blur-xl p-5 shadow-lg transition-all duration-300 overflow-hidden hover:border-cyan-500/60 hover:shadow-xl hover:shadow-cyan-400/20 hover:scale-[1.01]"
                >
                  {/* Glass shine overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {/* Accent gradient on hover */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400/20 to-sky-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-900/5 group-hover:bg-gradient-to-br group-hover:from-cyan-500/30 group-hover:to-sky-500/30 group-hover:shadow-lg group-hover:shadow-cyan-400/20 transition-all duration-300 shrink-0">
                        <span className="text-xl leading-none">
                          {demo.icon}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-700 group-hover:text-cyan-900 transition-colors duration-300 truncate">
                          {demo.title}
                        </h3>
                        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed line-clamp-2 group-hover:text-sky-800 transition-colors duration-300">
                          {demo.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center text-xs text-slate-400 group-hover:text-cyan-700 transition-colors duration-300">
                      <span>Open demo</span>
                      <svg
                        className="ml-1 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-900/10 py-8 text-center text-xs text-slate-400">
        Isonomia Platform — Internal Demo Nexus
      </div>
    </div>
  );
}
