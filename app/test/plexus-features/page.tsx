"use client";

/**
 * Plexus Features Demo Page
 *
 * Interactive demonstration of all Plexus cross-deliberation network features:
 *
 * CORE NETWORK VISUALIZATION:
 * - Radial/Force-directed graph view (Plexus.tsx)
 * - Card grid board view (PlexusBoard.tsx)
 * - Matrix heatmap view (PlexusMatrix.tsx)
 * - Room hover metrics (PlexusRoomMetrics.tsx)
 *
 * META-EDGE SYSTEM:
 * - Cross-references (xref)
 * - Claim overlap detection (overlap)
 * - Stack references (stack_ref)
 * - Argument imports (imports)
 * - Shared author connections (shared_author)
 *
 * ROOM FUNCTOR / TRANSPORT:
 * - Claim mapping between rooms
 * - Import preview & materialization
 * - Provenance tracking (ArgumentImport with SHA-1 fingerprints)
 * - Recursive premise import (depth 1-3)
 *
 * CONFIDENCE & FILTERING:
 * - Confidence modes (min | product | Dempster-Shafer)
 * - Threshold gating (tau slider)
 * - Edge kind toggles
 * - Room ordering & search
 *
 * Accessible at: /test/plexus-features
 */

import { useState, useCallback } from "react";
import { toast, Toaster } from "sonner";
import {
  Network,
  LayoutGrid,
  Grid3X3,
  ArrowRightLeft,
  Eye,
  Check,
  ChevronRight,
  BookOpen,
  ExternalLink,
  Search,
  Filter,
  SlidersHorizontal,
  Zap,
  GitBranch,
  Users,
  Link2,
  Layers,
  Import,
  Share2,
  Activity,
  BarChart3,
  CircleDot,
  Workflow,
  Globe,
  FileText,
  Shield,
  Fingerprint,
  ArrowDown,
  ArrowUp,
  MessageSquare,
  PlusCircle,
  Settings,
  ChevronDown,
  Play,
  Sparkles,
  Info,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type EdgeKind = "xref" | "overlap" | "stack_ref" | "imports" | "shared_author";
type ConfidenceMode = "min" | "product" | "ds";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const EDGE_COLORS: Record<EdgeKind, string> = {
  xref: "#6366f1",
  overlap: "#ef4444",
  stack_ref: "#f59e0b",
  imports: "#14b8a6",
  shared_author: "#64748b",
};

const EDGE_LABELS: Record<EdgeKind, string> = {
  xref: "Cross-ref",
  overlap: "Overlap",
  stack_ref: "Stack ref",
  imports: "Imports",
  shared_author: "Shared author",
};

const EDGE_DESCRIPTIONS: Record<EdgeKind, string> = {
  xref: "Generic cross-reference between deliberations",
  overlap: "Shared canonical claims detected via semantic similarity",
  stack_ref: "Architectural/stack-based dependency between rooms",
  imports: "Tracked argument import via Room Functor transport",
  shared_author: "Weak tie based on shared authorship across rooms",
};

const MOCK_ROOMS = [
  { id: "room-1", title: "Climate Policy Debate", nArgs: 48, nEdges: 12, accepted: 18, rejected: 6, undecided: 24, tags: ["climate", "policy"] },
  { id: "room-2", title: "Renewable Energy Policy", nArgs: 35, nEdges: 8, accepted: 14, rejected: 4, undecided: 17, tags: ["energy", "policy"] },
  { id: "room-3", title: "Carbon Tax Proposal", nArgs: 22, nEdges: 6, accepted: 10, rejected: 5, undecided: 7, tags: ["economics", "policy"] },
  { id: "room-4", title: "Ocean Acidification", nArgs: 19, nEdges: 4, accepted: 8, rejected: 2, undecided: 9, tags: ["climate", "marine"] },
  { id: "room-5", title: "AI Ethics & Governance", nArgs: 42, nEdges: 10, accepted: 16, rejected: 8, undecided: 18, tags: ["technology", "ethics"] },
  { id: "room-6", title: "Urban Planning 2030", nArgs: 15, nEdges: 3, accepted: 6, rejected: 2, undecided: 7, tags: ["urban", "policy"] },
  { id: "room-7", title: "Biodiversity Loss", nArgs: 28, nEdges: 7, accepted: 12, rejected: 3, undecided: 13, tags: ["climate", "ecology"] },
  { id: "room-8", title: "Digital Privacy Rights", nArgs: 31, nEdges: 5, accepted: 11, rejected: 7, undecided: 13, tags: ["technology", "rights"] },
];

const MOCK_EDGES = [
  { from: "room-1", to: "room-2", kind: "xref" as EdgeKind, weight: 3 },
  { from: "room-1", to: "room-3", kind: "overlap" as EdgeKind, weight: 5 },
  { from: "room-1", to: "room-4", kind: "stack_ref" as EdgeKind, weight: 2 },
  { from: "room-1", to: "room-7", kind: "imports" as EdgeKind, weight: 4 },
  { from: "room-2", to: "room-3", kind: "shared_author" as EdgeKind, weight: 2 },
  { from: "room-2", to: "room-6", kind: "xref" as EdgeKind, weight: 1 },
  { from: "room-3", to: "room-6", kind: "overlap" as EdgeKind, weight: 2 },
  { from: "room-4", to: "room-7", kind: "stack_ref" as EdgeKind, weight: 3 },
  { from: "room-5", to: "room-8", kind: "imports" as EdgeKind, weight: 6 },
  { from: "room-5", to: "room-3", kind: "shared_author" as EdgeKind, weight: 1 },
  { from: "room-7", to: "room-4", kind: "overlap" as EdgeKind, weight: 4 },
];

const MOCK_ROOM_METRICS = {
  schemes: [
    { key: "ARG_FROM_EXPERT", name: "Argument from Expert Opinion", count: 12 },
    { key: "ARG_FROM_ANALOGY", name: "Argument from Analogy", count: 8 },
    { key: "ARG_FROM_CAUSE", name: "Argument from Cause to Effect", count: 6 },
    { key: "ARG_FROM_SIGN", name: "Argument from Sign", count: 4 },
    { key: "ARG_FROM_PRECEDENT", name: "Argument from Precedent", count: 3 },
  ],
  cqStatus: { total: 24, answered: 18, open: 6 },
  conflictDensity: 0.35,
  dialogueActivity: { question: 15, assertion: 28, challenge: 8, concession: 4 },
  argumentCount: 48,
  conflictCount: 17,
};

const MOCK_CLAIM_MAP = [
  { sourceClaim: "CO2 emissions are the primary driver of warming", targetClaim: "Carbon pricing reduces emissions", similarity: 0.72 },
  { sourceClaim: "Sea level rise threatens coastal cities", targetClaim: "Urban planning must account for climate", similarity: 0.65 },
  { sourceClaim: "Renewable energy costs are declining", targetClaim: "Economic transition is feasible", similarity: 0.81 },
];

const MOCK_IMPORT_PREVIEW = [
  { argumentId: "arg-101", text: "Expert consensus supports a 2°C warming limit", scheme: "ARG_FROM_EXPERT", confidence: 0.88, premiseCount: 3 },
  { argumentId: "arg-102", text: "Historical data shows policy intervention reduces emissions", scheme: "ARG_FROM_PRECEDENT", confidence: 0.75, premiseCount: 2 },
  { argumentId: "arg-103", text: "Carbon taxes have proven effective in Nordic countries", scheme: "ARG_FROM_ANALOGY", confidence: 0.82, premiseCount: 4 },
];

const MOCK_PROVENANCE = [
  { id: "imp-1", originalArgId: "arg-101", materializedArgId: "arg-201", mode: "materialized", fingerprint: "a1b2c3d4e5", fromRoom: "Climate Policy Debate", toRoom: "Carbon Tax Proposal", importedAt: "2026-01-15" },
  { id: "imp-2", originalArgId: "arg-102", materializedArgId: null, mode: "virtual", fingerprint: "f6g7h8i9j0", fromRoom: "Renewable Energy Policy", toRoom: "Carbon Tax Proposal", importedAt: "2026-01-20" },
  { id: "imp-3", originalArgId: "arg-103", materializedArgId: "arg-203", mode: "materialized", fingerprint: "k1l2m3n4o5", fromRoom: "Climate Policy Debate", toRoom: "Urban Planning 2030", importedAt: "2026-02-01" },
];

const CONFIDENCE_MODES: { value: ConfidenceMode; label: string; description: string }[] = [
  { value: "min", label: "Minimum", description: "Takes the minimum confidence across the chain (conservative)" },
  { value: "product", label: "Product", description: "Multiplies confidences along the chain (default)" },
  { value: "ds", label: "Dempster-Shafer", description: "Combines evidence using belief/plausibility intervals" },
];

const PHASES = [
  {
    id: "core",
    title: "Core Network Visualization",
    description: "Three complementary views of the cross-deliberation network",
    features: [
      {
        id: "graph-view",
        title: "Graph View (Plexus.tsx)",
        description: "Radial/force-directed graph with rooms as nodes, meta-edges as links",
        icon: Network,
        status: "complete" as const,
        items: ["D3 force-directed / radial layout", "Edge color-coded by kind", "Zoom, pan, and drag interaction", "Labels on hover / always / auto mode"],
      },
      {
        id: "board-view",
        title: "Board View (PlexusBoard.tsx)",
        description: "Card grid with search, filtering, and drag-and-drop link creation",
        icon: LayoutGrid,
        status: "complete" as const,
        items: ["Searchable card grid", "Tag-based filtering", "Link-mode drag-and-drop", "Right-click transport actions"],
      },
      {
        id: "matrix-view",
        title: "Matrix View (PlexusMatrix.tsx)",
        description: "Canvas-based heatmap showing room-to-room connections",
        icon: Grid3X3,
        status: "complete" as const,
        items: ["Stacked bar charts per cell", "Edge kind breakdown", "Scrollable with mini-map", "Hover highlights row/column"],
      },
      {
        id: "room-metrics",
        title: "Room Metrics (PlexusRoomMetrics.tsx)",
        description: "Hover cards showing per-room scheme usage and conflict data",
        icon: BarChart3,
        status: "complete" as const,
        items: ["Top 5 argument schemes", "Critical question status", "Conflict density metric", "Dialogue activity breakdown"],
      },
    ],
  },
  {
    id: "meta-edges",
    title: "Meta-Edge System",
    description: "Five distinct edge types tracking different cross-room relationship semantics",
    features: [
      {
        id: "xref-edges",
        title: "Cross-References",
        description: "Generic cross-references between deliberations",
        icon: Link2,
        status: "complete" as const,
        items: ["User-created links", "Bidirectional references", "Weight aggregation", "Edge metadata tooltips"],
      },
      {
        id: "overlap-edges",
        title: "Claim Overlap Detection",
        description: "Auto-detected shared canonical claims via semantic similarity",
        icon: Layers,
        status: "complete" as const,
        items: ["Semantic similarity matching", "Canonical claim dedup", "Overlap weight = shared count", "Visual highlighting"],
      },
      {
        id: "stack-ref-edges",
        title: "Stack References",
        description: "Architectural dependencies via shared stacks/library connections",
        icon: FileText,
        status: "complete" as const,
        items: ["Stack-based dependency tracking", "StackReference model", "Amber-colored edges", "Source provenance"],
      },
      {
        id: "import-edges",
        title: "Argument Imports",
        description: "Tracked imports via Room Functor transport system",
        icon: Import,
        status: "complete" as const,
        items: ["SHA-1 fingerprint tracking", "Materialized vs virtual modes", "Teal-colored edges", "Import count weight"],
      },
      {
        id: "shared-author-edges",
        title: "Shared Author Ties",
        description: "Weak ties based on shared authorship across rooms",
        icon: Users,
        status: "complete" as const,
        items: ["SharedAuthorRoomEdge model", "Auto-detected connections", "Slate-colored edges", "Author count weight"],
      },
    ],
  },
  {
    id: "transport",
    title: "Room Functor / Transport",
    description: "Cross-room argument importing with claim mapping and provenance",
    features: [
      {
        id: "claim-mapping",
        title: "Claim Mapping",
        description: "Define how claims in one room map to claims in another",
        icon: MapPin,
        status: "complete" as const,
        items: ["Similarity-based suggestions", "Manual claim pairing", "ClaimMapJson storage", "Bidirectional mapping"],
      },
      {
        id: "import-preview",
        title: "Import Preview",
        description: "Preview which arguments would be imported before applying",
        icon: Eye,
        status: "complete" as const,
        items: ["Top-K arguments per claim", "Confidence scores shown", "Premise chain preview", "Depth control (1-3)"],
      },
      {
        id: "materialization",
        title: "Import Materialization",
        description: "Apply imports to create tracked ArgumentImport records",
        icon: Zap,
        status: "complete" as const,
        items: ["Materialized mode (copy)", "Virtual mode (reference)", "Recursive premise import", "roomFunctor:changed event"],
      },
      {
        id: "provenance",
        title: "Provenance Tracking",
        description: "Full import history with fingerprints and source tracking",
        icon: Fingerprint,
        status: "complete" as const,
        items: ["SHA-1 fingerprints", "Original ↔ materialized IDs", "Import timestamp", "Source room attribution"],
      },
    ],
  },
  {
    id: "confidence",
    title: "Confidence & Filtering",
    description: "Confidence scoring modes and network filtering controls",
    features: [
      {
        id: "confidence-modes",
        title: "Confidence Modes",
        description: "Three scoring modes for evaluating argument chains",
        icon: SlidersHorizontal,
        status: "complete" as const,
        items: ["Minimum (conservative)", "Product (default)", "Dempster-Shafer (belief intervals)", "localStorage persistence"],
      },
      {
        id: "threshold-gating",
        title: "Threshold Gating (Tau)",
        description: "Filter rooms by minimum confidence share",
        icon: Filter,
        status: "complete" as const,
        items: ["Adjustable tau slider", "Per-room gated share API", "Real-time filtering", "Cache invalidation on mode change"],
      },
      {
        id: "edge-toggles",
        title: "Edge Kind Toggles",
        description: "Show/hide specific edge types in the visualization",
        icon: Eye,
        status: "complete" as const,
        items: ["Per-kind toggle switches", "Color-coded indicators", "Count badges per kind", "Persistent across views"],
      },
      {
        id: "room-ordering",
        title: "Room Ordering & Search",
        description: "Sort and filter rooms across all three views",
        icon: Search,
        status: "complete" as const,
        items: ["Sort: recent/size/accept/alpha", "Full-text search", "Tag filtering", "Shared across views"],
      },
    ],
  },
];

const SYSTEM_EVENTS = [
  { name: "dialogue:changed", description: "Argument/label updates in a room" },
  { name: "xref:changed", description: "Cross-ref table modified" },
  { name: "plexus:links:changed", description: "Meta-edges created/updated" },
  { name: "roomFunctor:changed", description: "Functor mappings modified" },
  { name: "deliberations:created", description: "New room added to network" },
  { name: "plexus:board:*", description: "Internal board state updates" },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof PHASES)[0]["features"][0] }) {
  const Icon = feature.icon;

  return (
    <Card className="h-full bg-teal-50/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100 text-teal-700">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
              <CardDescription className="text-sm">{feature.description}</CardDescription>
            </div>
          </div>
          <Badge variant="default" className="bg-green-600">
            <Check className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {feature.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <ChevronRight className="w-3 h-3 text-slate-400" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function NetworkGraphPreview() {
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  return (
    <Card className="bg-teal-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5" />
          Graph View Preview
        </CardTitle>
        <CardDescription>
          Interactive radial/force-directed graph — rooms as nodes, meta-edges as colored links
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SVG Graph Preview */}
        <div className="border rounded-lg bg-slate-900 p-4 relative overflow-hidden" style={{ minHeight: 320 }}>
          <svg viewBox="0 0 600 320" className="w-full h-full">
            {/* Edges */}
            {MOCK_EDGES.map((edge, i) => {
              const fromRoom = MOCK_ROOMS.find(r => r.id === edge.from);
              const toRoom = MOCK_ROOMS.find(r => r.id === edge.to);
              if (!fromRoom || !toRoom) return null;
              const fi = MOCK_ROOMS.indexOf(fromRoom);
              const ti = MOCK_ROOMS.indexOf(toRoom);
              const fx = 120 + (fi % 4) * 120;
              const fy = 80 + Math.floor(fi / 4) * 160;
              const tx = 120 + (ti % 4) * 120;
              const ty = 80 + Math.floor(ti / 4) * 160;
              return (
                <line
                  key={i}
                  x1={fx} y1={fy} x2={tx} y2={ty}
                  stroke={EDGE_COLORS[edge.kind]}
                  strokeWidth={Math.min(edge.weight, 4)}
                  strokeOpacity={0.6}
                />
              );
            })}
            {/* Room Nodes */}
            {MOCK_ROOMS.map((room, i) => {
              const x = 120 + (i % 4) * 120;
              const y = 80 + Math.floor(i / 4) * 160;
              const radius = 16 + Math.min(room.nArgs / 4, 12);
              const isHovered = hoveredRoom === room.id;
              const isSelected = selectedRoom === room.id;

              return (
                <g
                  key={room.id}
                  onMouseEnter={() => setHoveredRoom(room.id)}
                  onMouseLeave={() => setHoveredRoom(null)}
                  onClick={() => {
                    setSelectedRoom(room.id);
                    toast.info(`Selected: ${room.title}`, { description: `${room.nArgs} arguments, ${room.nEdges} edges` });
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={x} cy={y} r={radius}
                    fill={isSelected ? "#14b8a6" : isHovered ? "#5eead4" : "#1e293b"}
                    stroke={isHovered || isSelected ? "#14b8a6" : "#475569"}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  {/* Acceptance arc */}
                  <circle
                    cx={x} cy={y} r={radius + 3}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray={`${(room.accepted / Math.max(1, room.accepted + room.rejected + room.undecided)) * 2 * Math.PI * (radius + 3)} ${2 * Math.PI * (radius + 3)}`}
                    strokeDashoffset={0}
                    transform={`rotate(-90 ${x} ${y})`}
                    strokeOpacity={0.8}
                  />
                  {isHovered && (
                    <text x={x} y={y - radius - 8} textAnchor="middle" fill="white" fontSize={10} fontWeight="500">
                      {room.title}
                    </text>
                  )}
                  <text x={x} y={y + 4} textAnchor="middle" fill="white" fontSize={9}>
                    {room.nArgs}
                  </text>
                </g>
              );
            })}
          </svg>
          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-2">
            {(Object.keys(EDGE_COLORS) as EdgeKind[]).map((kind) => (
              <div key={kind} className="flex items-center gap-1 text-xs text-white/70">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: EDGE_COLORS[kind] }} />
                {EDGE_LABELS[kind]}
              </div>
            ))}
          </div>
        </div>

        {/* Selected Room Metrics Preview */}
        {selectedRoom && (
          <div className="border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-teal-600" />
              <span className="font-medium text-sm">Room Metrics: {MOCK_ROOMS.find(r => r.id === selectedRoom)?.title}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Top Schemes</p>
                {MOCK_ROOM_METRICS.schemes.slice(0, 3).map((s) => (
                  <div key={s.key} className="flex items-center justify-between py-0.5">
                    <span className="text-xs text-slate-600 truncate">{s.name}</span>
                    <Badge variant="secondary" className="text-xs ml-1">{s.count}</Badge>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">CQ Status</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${(MOCK_ROOM_METRICS.cqStatus.answered / MOCK_ROOM_METRICS.cqStatus.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    {MOCK_ROOM_METRICS.cqStatus.answered}/{MOCK_ROOM_METRICS.cqStatus.total}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-2 mb-1">Conflict Density</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${MOCK_ROOM_METRICS.conflictDensity * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{(MOCK_ROOM_METRICS.conflictDensity * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Controls */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Zooming to fit all rooms...")}>
            <Eye className="w-3 h-3 mr-1" />
            Fit View
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Switching to radial layout...")}>
            <CircleDot className="w-3 h-3 mr-1" />
            Radial
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Switching to force-directed layout...")}>
            <Workflow className="w-3 h-3 mr-1" />
            Force
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BoardViewPreview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [orderBy, setOrderBy] = useState<string>("recent");
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);

  const filteredRooms = MOCK_ROOMS.filter(r =>
    !searchQuery || (r.title ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="bg-teal-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5" />
          Board View Preview
        </CardTitle>
        <CardDescription>
          Card grid with search, tag filters, ordering, and drag-and-drop link creation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          <Select value={orderBy} onValueChange={setOrderBy}>
            <SelectTrigger className="w-[130px] bg-white">
              <SelectValue placeholder="Order by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="size">Size</SelectItem>
              <SelectItem value="accept">Acceptance</SelectItem>
              <SelectItem value="alpha">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={linkMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setLinkMode(!linkMode);
              setLinkSource(null);
              toast.info(linkMode ? "Link mode disabled" : "Link mode enabled — click a room to start");
            }}
            className={linkMode ? "bg-teal-600 hover:bg-teal-700" : ""}
          >
            <Link2 className="w-3 h-3 mr-1" />
            {linkMode ? "Linking..." : "Link Mode"}
          </Button>
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap gap-1.5">
          {["climate", "policy", "energy", "technology", "ethics", "marine", "ecology", "urban", "rights", "economics"].map(tag => (
            <Badge
              key={tag}
              variant="outline"
              className="text-xs cursor-pointer hover:bg-teal-100 hover:border-teal-300 transition-colors"
              onClick={() => setSearchQuery(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>

        {/* Room Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          {filteredRooms.slice(0, 6).map((room) => {
            const total = Math.max(1, room.accepted + room.rejected + room.undecided);
            const acceptPct = (room.accepted / total * 100).toFixed(0);
            const isLinkSource = linkSource === room.id;

            return (
              <div
                key={room.id}
                onClick={() => {
                  if (linkMode) {
                    if (!linkSource) {
                      setLinkSource(room.id);
                      toast.info(`Source: ${room.title}`, { description: "Now click a target room" });
                    } else if (linkSource !== room.id) {
                      toast.success(`Link created: ${MOCK_ROOMS.find(r => r.id === linkSource)?.title} → ${room.title}`, {
                        description: "POST /api/agora/links",
                      });
                      setLinkSource(null);
                      setLinkMode(false);
                    }
                  } else {
                    toast.info(`Room: ${room.title}`, { description: `${room.nArgs} arguments` });
                  }
                }}
                className={`border rounded-lg p-3 bg-white transition-all cursor-pointer ${
                  isLinkSource
                    ? "border-teal-500 ring-2 ring-teal-200 bg-teal-50"
                    : linkMode
                      ? "hover:border-teal-400 hover:bg-teal-50/50"
                      : "hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm truncate flex-1">{room.title}</h4>
                  {isLinkSource && <Badge className="bg-teal-600 text-xs ml-1">Source</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                  <span>{room.nArgs} args</span>
                  <span>{room.nEdges} edges</span>
                </div>
                {/* Acceptance bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500" style={{ width: `${acceptPct}%` }} />
                    <div className="h-full bg-red-400" style={{ width: `${(room.rejected / total * 100).toFixed(0)}%` }} />
                  </div>
                  <span className="text-xs text-slate-400">{acceptPct}%</span>
                </div>
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {room.tags?.map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{tag}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MatrixViewPreview() {
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number } | null>(null);

  const rooms = MOCK_ROOMS.slice(0, 6);
  const cellSize = 48;

  const getEdge = (fromId: string, toId: string) => {
    return MOCK_EDGES.filter(e =>
      (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
    );
  };

  return (
    <Card className="bg-teal-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5" />
          Matrix View Preview
        </CardTitle>
        <CardDescription>
          Canvas-based heatmap showing room-to-room connections with stacked bar charts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg bg-white p-4 overflow-x-auto">
          <div className="inline-block">
            {/* Header Row */}
            <div className="flex">
              <div style={{ width: 100, height: cellSize }} className="flex items-end justify-end pr-2 pb-1">
                <span className="text-[10px] text-slate-400">from ↓ / to →</span>
              </div>
              {rooms.map((room, j) => (
                <div
                  key={room.id}
                  style={{ width: cellSize, height: cellSize }}
                  className={`flex items-end justify-center pb-1 ${hoveredCell?.j === j ? "bg-teal-50" : ""}`}
                >
                  <span className="text-[9px] text-slate-500 -rotate-45 origin-bottom-left whitespace-nowrap overflow-hidden max-w-[60px] truncate">
                    {room.title?.split(" ").slice(0, 2).join(" ")}
                  </span>
                </div>
              ))}
            </div>
            {/* Matrix Body */}
            {rooms.map((fromRoom, i) => (
              <div key={fromRoom.id} className="flex">
                <div
                  style={{ width: 100, height: cellSize }}
                  className={`flex items-center justify-end pr-2 text-xs text-slate-600 truncate ${hoveredCell?.i === i ? "bg-teal-50" : ""}`}
                >
                  {fromRoom.title?.split(" ").slice(0, 2).join(" ")}
                </div>
                {rooms.map((toRoom, j) => {
                  const edges = getEdge(fromRoom.id, toRoom.id);
                  const isHovered = hoveredCell?.i === i && hoveredCell?.j === j;
                  const isDiagonal = i === j;

                  return (
                    <div
                      key={toRoom.id}
                      style={{ width: cellSize, height: cellSize }}
                      className={`border border-slate-100 flex items-end justify-center p-0.5 cursor-pointer transition-colors ${
                        isDiagonal ? "bg-slate-50" : isHovered ? "bg-teal-100 border-teal-300" : "hover:bg-slate-50"
                      }`}
                      onMouseEnter={() => setHoveredCell({ i, j })}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => {
                        if (edges.length > 0) {
                          toast.info(`${fromRoom.title} ↔ ${toRoom.title}`, {
                            description: edges.map(e => `${EDGE_LABELS[e.kind]} (w:${e.weight})`).join(", "),
                          });
                        }
                      }}
                    >
                      {!isDiagonal && edges.length > 0 && (
                        <div className="flex gap-px items-end h-full">
                          {edges.map((e, k) => (
                            <div
                              key={k}
                              className="rounded-sm"
                              style={{
                                backgroundColor: EDGE_COLORS[e.kind],
                                width: Math.max(4, Math.floor((cellSize - 8) / edges.length)),
                                height: `${Math.min(100, e.weight * 20)}%`,
                                opacity: 0.8,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Matrix Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          {(Object.keys(EDGE_COLORS) as EdgeKind[]).map((kind) => (
            <div key={kind} className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: EDGE_COLORS[kind] }} />
              {EDGE_LABELS[kind]}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EdgeTypesDemo() {
  const [selectedEdge, setSelectedEdge] = useState<EdgeKind | null>(null);
  const [enabledEdges, setEnabledEdges] = useState<Record<EdgeKind, boolean>>({
    xref: true,
    overlap: true,
    stack_ref: true,
    imports: true,
    shared_author: false,
  });

  return (
    <Card className="bg-teal-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Meta-Edge Types
        </CardTitle>
        <CardDescription>
          Five distinct edge kinds with color-coded visualization and toggle controls
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Edge Toggles */}
        <div>
          <p className="text-sm font-medium mb-2">Edge Kind Toggles:</p>
          <div className="space-y-2">
            {(Object.keys(EDGE_COLORS) as EdgeKind[]).map((kind) => {
              const edgeCount = MOCK_EDGES.filter(e => e.kind === kind).length;
              const isEnabled = enabledEdges[kind];
              const isSelected = selectedEdge === kind;

              return (
                <div
                  key={kind}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-teal-500 bg-teal-50 ring-1 ring-teal-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => setSelectedEdge(isSelected ? null : kind)}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEnabledEdges(prev => ({ ...prev, [kind]: !prev[kind] }));
                        toast.info(`${EDGE_LABELS[kind]}: ${!isEnabled ? "shown" : "hidden"}`);
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isEnabled ? "border-teal-500 bg-teal-500" : "border-slate-300"
                      }`}
                    >
                      {isEnabled && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div
                      className="w-4 h-1 rounded-full"
                      style={{ backgroundColor: EDGE_COLORS[kind] }}
                    />
                    <div>
                      <span className="text-sm font-medium">{EDGE_LABELS[kind]}</span>
                      <p className="text-xs text-slate-500">{EDGE_DESCRIPTIONS[kind]}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">{edgeCount}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Edge Detail */}
        {selectedEdge && (
          <div className="border rounded-lg p-3 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: EDGE_COLORS[selectedEdge] }}
              />
              <span className="font-medium text-sm">{EDGE_LABELS[selectedEdge]} Edges</span>
            </div>
            <div className="space-y-1.5">
              {MOCK_EDGES.filter(e => e.kind === selectedEdge).map((edge, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-slate-50 rounded">
                  <span className="text-slate-600">
                    {MOCK_ROOMS.find(r => r.id === edge.from)?.title} → {MOCK_ROOMS.find(r => r.id === edge.to)?.title}
                  </span>
                  <span className="text-slate-400">w:{edge.weight}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoomFunctorDemo() {
  const [step, setStep] = useState<number>(0);
  const [sourceRoom] = useState(MOCK_ROOMS[0]);
  const [targetRoom] = useState(MOCK_ROOMS[2]);
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());

  const steps = [
    { label: "Select Rooms", icon: Globe },
    { label: "Map Claims", icon: MapPin },
    { label: "Preview Imports", icon: Eye },
    { label: "Apply & Track", icon: Zap },
  ];

  return (
    <Card className="bg-teal-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5" />
          Room Functor Transport
        </CardTitle>
        <CardDescription>
          Cross-room argument import workflow: select → map → preview → apply
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step Indicator */}
        <div className="flex items-center gap-1">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center">
                <button
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    i === step
                      ? "bg-teal-600 text-white"
                      : i < step
                        ? "bg-teal-100 text-teal-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i < step ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  {s.label}
                </button>
                {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="border-2 border-teal-500 rounded-lg p-3 bg-teal-50">
                <Badge className="bg-teal-600 mb-2">Source</Badge>
                <h4 className="font-medium text-sm">{sourceRoom.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{sourceRoom.nArgs} arguments • {sourceRoom.accepted} accepted</p>
              </div>
              <div className="border-2 border-indigo-500 rounded-lg p-3 bg-indigo-50">
                <Badge className="bg-indigo-600 mb-2">Target</Badge>
                <h4 className="font-medium text-sm">{targetRoom.title}</h4>
                <p className="text-xs text-slate-500 mt-1">{targetRoom.nArgs} arguments • {targetRoom.accepted} accepted</p>
              </div>
            </div>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setStep(1)}>
              Define Claim Map <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Map claims from source to target room (suggested by similarity):</p>
            <div className="space-y-2">
              {MOCK_CLAIM_MAP.map((mapping, i) => (
                <div key={i} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] bg-teal-50 border-teal-300">Source</Badge>
                    <span className="text-xs text-slate-700">{mapping.sourceClaim}</span>
                  </div>
                  <div className="flex items-center gap-2 pl-4 my-1">
                    <ArrowDown className="w-3 h-3 text-slate-400" />
                    <Badge variant="secondary" className="text-[10px]">{(mapping.similarity * 100).toFixed(0)}% similar</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-300">Target</Badge>
                    <span className="text-xs text-slate-700">{mapping.targetClaim}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              API: POST /api/room-functor/transport • POST /api/room-functor/claims (for suggestions)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(0)}>Back</Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setStep(2)}>
                Preview Imports <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Preview arguments that will be imported:</p>
            <div className="space-y-2">
              {MOCK_IMPORT_PREVIEW.map((arg) => {
                const isSelected = selectedProposals.has(arg.argumentId);
                return (
                  <div
                    key={arg.argumentId}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      isSelected ? "border-teal-500 bg-teal-50 ring-1 ring-teal-200" : "bg-white hover:border-slate-300"
                    }`}
                    onClick={() => {
                      setSelectedProposals(prev => {
                        const next = new Set(prev);
                        if (next.has(arg.argumentId)) next.delete(arg.argumentId);
                        else next.add(arg.argumentId);
                        return next;
                      });
                    }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm text-slate-700 flex-1">{arg.text}</p>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ml-2 ${
                        isSelected ? "border-teal-500 bg-teal-500" : "border-slate-300"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{arg.scheme}</Badge>
                      <span className="text-[10px] text-slate-400">conf: {arg.confidence}</span>
                      <span className="text-[10px] text-slate-400">{arg.premiseCount} premises</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              API: POST /api/room-functor/preview • Depth: 1-3 (recursive premise import)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>Back</Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
                disabled={selectedProposals.size === 0}
                onClick={() => {
                  setStep(3);
                  toast.success(`${selectedProposals.size} arguments imported!`, {
                    description: "ArgumentImport records created with SHA-1 fingerprints",
                  });
                }}
              >
                <Zap className="w-3 h-3 mr-1" />
                Apply ({selectedProposals.size}) <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-700">
                <Check className="w-4 h-4 inline mr-1" />
                Import Complete — {selectedProposals.size} arguments imported
              </p>
              <p className="text-xs text-green-600 mt-1">
                Event emitted: roomFunctor:changed • API: POST /api/room-functor/apply
              </p>
            </div>
            <p className="text-sm font-medium text-slate-700">Provenance Records:</p>
            <div className="space-y-2">
              {MOCK_PROVENANCE.map((p) => (
                <div key={p.id} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{p.fromRoom} → {p.toRoom}</span>
                    <Badge variant={p.mode === "materialized" ? "default" : "outline"} className="text-[10px]">
                      {p.mode}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Fingerprint className="w-3 h-3" />
                      {p.fingerprint}
                    </span>
                    <span>Original: {p.originalArgId}</span>
                    {p.materializedArgId && <span>Materialized: {p.materializedArgId}</span>}
                    <span>{p.importedAt}</span>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setStep(0); setSelectedProposals(new Set()); }}>
              Start New Transport
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfidenceControlsDemo() {
  const [mode, setMode] = useState<ConfidenceMode>("product");
  const [tau, setTau] = useState<number>(50);

  const gatedRooms = MOCK_ROOMS.filter(r => {
    const total = Math.max(1, r.accepted + r.rejected + r.undecided);
    const share = (r.accepted / total) * 100;
    return share >= tau;
  });

  return (
    <Card className="bg-teal-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5" />
          Confidence Controls
        </CardTitle>
        <CardDescription>
          Scoring mode selection and threshold gating — persisted to localStorage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Selector */}
        <div>
          <p className="text-sm font-medium mb-2">Confidence Mode:</p>
          <div className="grid grid-cols-3 gap-2">
            {CONFIDENCE_MODES.map((m) => {
              const isSelected = mode === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => {
                    setMode(m.value);
                    toast.info(`Confidence mode: ${m.label}`, { description: m.description });
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-teal-500 bg-teal-50 ring-2 ring-teal-200"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white"
                  }`}
                >
                  <p className={`text-sm font-medium ${isSelected ? "text-teal-700" : ""}`}>{m.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tau Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Threshold (τ): {tau}%</p>
            <Badge variant="secondary" className="text-xs">{gatedRooms.length}/{MOCK_ROOMS.length} rooms visible</Badge>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={tau}
            onChange={(e) => setTau(Number(e.target.value))}
            className="w-full accent-teal-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>0% (show all)</span>
            <span>100% (strict)</span>
          </div>
        </div>

        {/* Gated Room Preview */}
        <div>
          <p className="text-sm font-medium mb-2">Visible Rooms (τ ≥ {tau}%):</p>
          <div className="flex flex-wrap gap-1.5">
            {gatedRooms.map((room) => {
              const total = Math.max(1, room.accepted + room.rejected + room.undecided);
              const share = ((room.accepted / total) * 100).toFixed(0);
              return (
                <Badge key={room.id} variant="outline" className="text-xs bg-white">
                  {room.title?.split(" ").slice(0, 2).join(" ")} ({share}%)
                </Badge>
              );
            })}
            {gatedRooms.length === 0 && (
              <p className="text-xs text-slate-400 italic">No rooms meet the threshold</p>
            )}
          </div>
        </div>

        {/* Formula Display */}
        <div className="border rounded-lg p-3 bg-white">
          <p className="text-xs font-medium text-slate-700 mb-1.5">Current Formula:</p>
          <div className="font-mono text-xs text-slate-600 bg-slate-50 p-2 rounded">
            {mode === "min" && "confidence(chain) = min(c₁, c₂, ..., cₙ)"}
            {mode === "product" && "confidence(chain) = c₁ × c₂ × ... × cₙ"}
            {mode === "ds" && "bel(H) = Σ m(A) for A ⊆ H; pl(H) = 1 − bel(¬H)"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemEventsDemo() {
  const [firedEvents, setFiredEvents] = useState<Set<string>>(new Set());

  return (
    <Card className="bg-teal-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System Events
        </CardTitle>
        <CardDescription>
          Custom DOM events for cross-component synchronization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {SYSTEM_EVENTS.map((evt) => {
          const isFired = firedEvents.has(evt.name);
          return (
            <div
              key={evt.name}
              className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                isFired ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{evt.name}</code>
                <span className="text-xs text-slate-500">{evt.description}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setFiredEvents(prev => new Set([...prev, evt.name]));
                  toast.success(`Event fired: ${evt.name}`);
                  setTimeout(() => {
                    setFiredEvents(prev => {
                      const next = new Set(prev);
                      next.delete(evt.name);
                      return next;
                    });
                  }, 2000);
                }}
              >
                <Play className="w-3 h-3 mr-1" />
                Fire
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function PlexusFeaturesPage() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Toaster position="bottom-right" richColors />

        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5">
              <Network className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-700">Plexus System</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Plexus Features Demo
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Cross-deliberation network visualization, meta-edge management,
              room functor transport, and confidence-gated filtering.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Network className="w-4 h-4" />
                {MOCK_ROOMS.length} rooms
              </span>
              <span className="flex items-center gap-1.5">
                <GitBranch className="w-4 h-4" />
                {MOCK_EDGES.length} edges
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                5 edge types
              </span>
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4" />
                Room Functor transport
              </span>
            </div>
          </div>

          {/* Feature Overview Grid */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="views">Views</TabsTrigger>
              <TabsTrigger value="edges">Meta-Edges</TabsTrigger>
              <TabsTrigger value="transport">Transport</TabsTrigger>
              <TabsTrigger value="confidence">Confidence</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-8">
              {PHASES.map((phase) => (
                <div key={phase.id} className="space-y-4">
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <h3 className="font-semibold text-lg">{phase.title}</h3>
                    <p className="text-sm text-muted-foreground">{phase.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {phase.features.map((feature) => (
                      <FeatureCard key={feature.id} feature={feature} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Architecture Summary */}
              <Card className="bg-slate-800 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Plexus Architecture Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-teal-300">Visualization Components</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Plexus.tsx (graph view)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> PlexusBoard.tsx (card grid)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> PlexusMatrix.tsx (heatmap)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> PlexusRoomMetrics.tsx (hover card)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-teal-300">Data Models (Prisma)</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> XRef</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> StackReference</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> ArgumentImport</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> SharedAuthorRoomEdge</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> RoomFunctor</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-teal-300">API Endpoints</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> GET /api/agora/network</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> GET /api/agora/room-metrics</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> GET /api/agora/edge-metadata</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/agora/links</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/room-functor/*</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-300">Hooks:</strong>{" "}
                      <code className="bg-slate-700 px-1 rounded">useConfidence()</code> manages scoring mode + tau (persisted to localStorage) •{" "}
                      <code className="bg-slate-700 px-1 rounded">useRoomGraphPrefetch()</code> background-fetches room graph data with dedup
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Views Tab */}
            <TabsContent value="views" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Network Visualization Views</h3>
                <p className="text-sm text-muted-foreground">
                  Three complementary views for exploring the cross-deliberation network, each with unique affordances.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <NetworkGraphPreview />
                <BoardViewPreview />
              </div>
              <MatrixViewPreview />

              {/* Live Component Link */}
              <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-white shadow-sm">
                        <Sparkles className="w-6 h-6 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-teal-900">Try the Live Plexus</h3>
                        <p className="text-sm text-teal-700">
                          Interactive cross-deliberation network with real data
                        </p>
                      </div>
                    </div>
                    <Button asChild className="bg-teal-600 hover:bg-teal-700">
                      <a href="/agora">
                        Open Agora <ExternalLink className="w-4 h-4 ml-2" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Meta-Edges Tab */}
            <TabsContent value="edges" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Meta-Edge System</h3>
                <p className="text-sm text-muted-foreground">
                  Five distinct edge types model different cross-room relationship semantics, stored in dedicated Prisma models.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <EdgeTypesDemo />
                <Card className="bg-teal-50/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      Edge API Reference
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Create Edge */}
                    <div className="border rounded-lg p-3 bg-white">
                      <p className="text-xs font-medium text-teal-700 mb-1">POST /api/agora/links</p>
                      <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
{`{
  "kind": "xref",
  "fromId": "room-1",
  "toId": "room-2",
  "meta": { "reason": "Shared climate topic" }
}`}
                      </pre>
                    </div>
                    {/* Fetch Network */}
                    <div className="border rounded-lg p-3 bg-white">
                      <p className="text-xs font-medium text-teal-700 mb-1">GET /api/agora/network</p>
                      <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
{`?scope=public|following
&maxRooms=80

→ { scope, version, rooms[], edges[] }`}
                      </pre>
                    </div>
                    {/* Edge Metadata */}
                    <div className="border rounded-lg p-3 bg-white">
                      <p className="text-xs font-medium text-teal-700 mb-1">GET /api/agora/edge-metadata</p>
                      <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
{`?from=room-1&to=room-2&kind=xref

→ { ok, from, to, kind, details }`}
                      </pre>
                    </div>
                    {/* Data Model Reference */}
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-slate-700 mb-2">Prisma Models:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { model: "XRef", desc: "Generic cross-refs" },
                          { model: "StackReference", desc: "Stack-based links" },
                          { model: "ArgumentImport", desc: "Import provenance" },
                          { model: "SharedAuthorRoomEdge", desc: "Shared authors" },
                          { model: "RoomFunctor", desc: "Claim mappings" },
                        ].map((m) => (
                          <div key={m.model} className="flex items-center gap-1.5 text-xs">
                            <Check className="w-3 h-3 text-green-500" />
                            <span className="font-mono text-slate-700">{m.model}</span>
                            <span className="text-slate-400">— {m.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Transport Tab */}
            <TabsContent value="transport" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Room Functor Transport</h3>
                <p className="text-sm text-muted-foreground">
                  Import arguments across deliberations with claim mapping, preview, materialization, and full provenance tracking.
                </p>
              </div>
              <RoomFunctorDemo />

              {/* Transport API Reference */}
              <Card className="bg-slate-800 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Room Functor API Reference
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-teal-300">Transport Endpoints</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/room-functor/transport</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/room-functor/preview</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/room-functor/apply</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/room-functor/map</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/room-functor/claims</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-teal-300">Import Modes</p>
                      <ul className="space-y-2 text-slate-300 text-xs">
                        <li>
                          <span className="font-mono text-teal-400">materialized</span> — Creates a copy of the argument in the target room with full provenance
                        </li>
                        <li>
                          <span className="font-mono text-teal-400">virtual</span> — Creates a reference link without copying (lighter weight)
                        </li>
                        <li>
                          <span className="font-mono text-teal-400">all</span> — Both materialized and virtual modes combined
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-300">Workflow:</strong>{" "}
                      Select rooms → Define claim map (claimMapJson) → Preview top-K arguments → Apply import →
                      ArgumentImport records created with SHA-1 fingerprints → roomFunctor:changed event emitted
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Confidence Tab */}
            <TabsContent value="confidence" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Confidence & Filtering</h3>
                <p className="text-sm text-muted-foreground">
                  Three confidence scoring modes, threshold gating, and edge filtering — all persisted to localStorage via useConfidence() hook.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ConfidenceControlsDemo />
                <Card className="bg-teal-50/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Confidence Architecture
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* useConfidence Hook */}
                    <div className="border rounded-lg p-3 bg-white">
                      <p className="text-xs font-medium text-teal-700 mb-1">useConfidence() Hook</p>
                      <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
{`type Mode = "min" | "product" | "ds";
type Ctx = {
  mode: Mode;
  setMode: (m: Mode) => void;
  tau: number | null;
  setTau: (t: number | null) => void;
};

// Persisted to localStorage("agora:confidence")
// Shared between graph + sheet views`}
                      </pre>
                    </div>

                    {/* Gated Share API */}
                    <div className="border rounded-lg p-3 bg-white">
                      <p className="text-xs font-medium text-teal-700 mb-1">Per-Room Gated Share</p>
                      <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
{`// Fetches acceptance share for a room
// applying the current confidence mode
const fetchGated = async (roomId: string) => {
  // Cached in gatedShare.current Map
  // Invalidated on mode/tau change
  ...
}`}
                      </pre>
                    </div>

                    {/* Integration Points */}
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-slate-700 mb-2">Integration Points:</p>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          Plexus.tsx — filters nodes by tau
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          PlexusBoard.tsx — grays out low-confidence rooms
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          PlexusMatrix.tsx — dims low-confidence cells
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          ConfidenceProvider wraps all plexus views
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">System Events & Synchronization</h3>
                <p className="text-sm text-muted-foreground">
                  Custom DOM events enable cross-component synchronization across all plexus views.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SystemEventsDemo />
                <Card className="bg-teal-50/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Workflow className="w-5 h-5" />
                      Event Flow Architecture
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border rounded-lg p-4 bg-white">
                      <p className="text-xs font-medium text-slate-700 mb-3">Component ↔ Event Mapping:</p>
                      <div className="space-y-3">
                        {[
                          { component: "Plexus.tsx", listens: ["dialogue:changed", "plexus:links:changed", "roomFunctor:changed"], emits: ["plexus:links:changed"] },
                          { component: "PlexusBoard.tsx", listens: ["deliberations:created", "plexus:links:changed"], emits: ["plexus:board:*"] },
                          { component: "Room Functor API", listens: [], emits: ["roomFunctor:changed"] },
                        ].map((c) => (
                          <div key={c.component} className="text-xs">
                            <p className="font-mono font-medium text-slate-700">{c.component}</p>
                            <div className="flex gap-4 mt-1 ml-3">
                              {c.listens.length > 0 && (
                                <div>
                                  <span className="text-slate-400">listens:</span>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {c.listens.map(e => (
                                      <code key={e} className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded">{e}</code>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {c.emits.length > 0 && (
                                <div>
                                  <span className="text-slate-400">emits:</span>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {c.emits.map(e => (
                                      <code key={e} className="text-[10px] bg-green-50 text-green-600 px-1 rounded">{e}</code>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SWR Revalidation Pattern */}
                    <div className="border rounded-lg p-3 bg-white">
                      <p className="text-xs font-medium text-teal-700 mb-1">SWR Revalidation Pattern</p>
                      <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">
{`// Listen for events and revalidate SWR
useEffect(() => {
  const handler = () => mutate();
  window.addEventListener("plexus:links:changed", handler);
  window.addEventListener("roomFunctor:changed", handler);
  return () => {
    window.removeEventListener("plexus:links:changed", handler);
    window.removeEventListener("roomFunctor:changed", handler);
  };
}, [mutate]);`}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="text-center text-sm text-slate-500 pb-8">
            <p>Plexus Features Demo • Cross-Deliberation Network System • Mesh Platform</p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
