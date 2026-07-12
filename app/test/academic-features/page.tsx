"use client";

/**
 * Academic Features Demo Page
 *
 * Interactive demonstration of all scholarly deliberation features:
 * - Phase 1: Paper-to-Claim Pipeline, Claim Search
 * - Phase 2: Debate Releases & Versioning, Forks & Merges
 * - Phase 3: Provenance & Challenges, Export Formats, Argument Citations, Quotes
 *
 * Accessible at: /test/academic-features
 */

import * as React from "react";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  FileText,
  Search,
  GitBranch,
  History,
  Download,
  Link2,
  BookOpen,
  Shield,
  Users,
  Sparkles,
  ChevronRight,
  Check,
  Copy,
  ExternalLink,
  ArrowRight,
  ArrowUpRight,
  Quote,
  Scale,
  Network,
  MessageSquare,
  Upload,
  Eye,
  AlertTriangle,
  Archive,
  Calendar,
  Compass,
  PlusCircle,
  Settings,
  GripVertical,
  Globe,
  Import,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  ArgumentCitationBadge,
  CitationTypeSelector,
  PermalinkCopyButton,
  ArgumentCitationCard,
  CitationGraphStats,
} from "@/components/citations/argument";
import type {
  ArgCitationType,
  ArgumentCitationSummary,
  CitationGraph,
} from "@/lib/citations/argumentCitationTypes";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CITATION_GRAPH: CitationGraph = {
  nodes: [
    { id: "arg-1", label: "Climate Change Thesis", type: "argument", citationCount: 5 },
    { id: "arg-2", label: "Policy Response", type: "argument", citationCount: 3 },
    { id: "arg-3", label: "Economic Impact", type: "argument", citationCount: 2 },
    { id: "arg-4", label: "Renewable Energy", type: "argument", citationCount: 4 },
    { id: "arg-5", label: "Carbon Tax", type: "argument", citationCount: 1 },
  ],
  edges: [
    { source: "arg-2", target: "arg-1", citationType: "SUPPORT", weight: 1 },
    { source: "arg-3", target: "arg-1", citationType: "EXTENSION", weight: 1 },
    { source: "arg-4", target: "arg-2", citationType: "APPLICATION", weight: 1 },
    { source: "arg-5", target: "arg-3", citationType: "CONTRAST", weight: 1 },
    { source: "arg-4", target: "arg-3", citationType: "REBUTTAL", weight: 1 },
  ],
  totalNodes: 5,
  totalEdges: 5,
};

const MOCK_CITATIONS: ArgumentCitationSummary[] = [
  {
    id: "cit-1",
    citingArgumentId: "arg-2",
    citedArgumentId: "arg-1",
    citationType: "SUPPORT",
    annotation: "This argument provides foundational evidence for the policy response.",
    createdById: "user-1",
    createdAt: new Date("2026-01-15"),
    citedArgument: {
      id: "arg-1",
      text: "Climate change is accelerating beyond predicted models, requiring immediate policy intervention.",
      authorId: "user-2",
      deliberationId: "delib-1",
      deliberationTitle: "Climate Policy Debate",
    },
  },
  {
    id: "cit-2",
    citingArgumentId: "arg-3",
    citedArgumentId: "arg-1",
    citationType: "EXTENSION",
    annotation: "Extending the analysis to include economic considerations.",
    createdById: "user-1",
    createdAt: new Date("2026-01-20"),
    citedArgument: {
      id: "arg-1",
      text: "Climate change is accelerating beyond predicted models, requiring immediate policy intervention.",
      authorId: "user-2",
      deliberationId: "delib-1",
      deliberationTitle: "Climate Policy Debate",
    },
  },
  {
    id: "cit-3",
    citingArgumentId: "arg-5",
    citedArgumentId: "arg-3",
    citationType: "REBUTTAL",
    annotation: "The economic analysis fails to account for transition costs.",
    createdById: "user-3",
    createdAt: new Date("2026-01-25"),
    citedArgument: {
      id: "arg-3",
      text: "Economic benefits of climate action outweigh short-term costs by a factor of 3:1.",
      authorId: "user-1",
      deliberationId: "delib-1",
      deliberationTitle: "Climate Policy Debate",
    },
  },
];

const MOCK_EXPORT_FORMATS = [
  { id: "bibtex", label: "BibTeX", icon: FileText, description: "LaTeX bibliography format" },
  { id: "ris", label: "RIS", icon: FileText, description: "Research Information Systems" },
  { id: "markdown", label: "Markdown", icon: FileText, description: "With TOC and frontmatter" },
  { id: "pdf", label: "PDF", icon: Download, description: "Print-ready document" },
];

const CITATION_FORMATS = [
  {
    format: "apa" as const,
    label: "APA (7th ed.)",
    sample: "Smith, J. (2026). Climate change argument. In Climate Policy Debate. Mesh. Retrieved from https://mesh.app/a/xK3m9pQw",
  },
  {
    format: "mla" as const,
    label: "MLA (9th ed.)",
    sample: "Smith, John. \"Climate change argument.\" Climate Policy Debate, Mesh, 2026, mesh.app/a/xK3m9pQw.",
  },
  {
    format: "chicago" as const,
    label: "Chicago (17th ed.)",
    sample: "Smith, John. \"Climate change argument.\" In Climate Policy Debate. Mesh, 2026. https://mesh.app/a/xK3m9pQw.",
  },
  {
    format: "bibtex" as const,
    label: "BibTeX",
    sample: "@misc{mesh_xK3m9pQw,\n  author = {Smith, John},\n  title = {Climate change argument},\n  howpublished = {Mesh},\n  year = {2026},\n  url = {https://mesh.app/a/xK3m9pQw}\n}",
  },
];

const CITATION_TYPE_COLORS: Record<string, string> = {
  SUPPORT: "bg-green-100 text-green-700 border-green-300",
  EXTENSION: "bg-blue-100 text-blue-700 border-blue-300",
  APPLICATION: "bg-purple-100 text-purple-700 border-purple-300",
  CONTRAST: "bg-amber-100 text-amber-700 border-amber-300",
  REBUTTAL: "bg-red-100 text-red-700 border-red-300",
  REFINEMENT: "bg-teal-100 text-teal-700 border-teal-300",
  METHODOLOGY: "bg-indigo-100 text-indigo-700 border-indigo-300",
  CRITIQUE: "bg-orange-100 text-orange-700 border-orange-300",
};

const MOCK_EXTRACTED_CLAIMS = [
  { id: "c1", text: "Global temperatures have risen 1.1°C since pre-industrial levels", confidence: 0.95, page: 3 },
  { id: "c2", text: "Arctic sea ice has declined by 13% per decade since 1979", confidence: 0.91, page: 5 },
  { id: "c3", text: "Immediate policy intervention could limit warming to 1.5°C", confidence: 0.82, page: 12 },
  { id: "c4", text: "Transition costs are offset by long-term economic gains within 15 years", confidence: 0.78, page: 18 },
];

const MOCK_SEARCH_RESULTS = [
  { id: "sr-1", text: "Ocean acidification threatens marine biodiversity", delib: "Marine Science Discussion", score: 92, claims: 14 },
  { id: "sr-2", text: "Carbon capture technology remains economically unviable at scale", delib: "Energy Policy Forum", score: 87, claims: 8 },
  { id: "sr-3", text: "Urban heat islands amplify climate impacts in cities", delib: "Urban Planning Deliberation", score: 74, claims: 6 },
  { id: "sr-4", text: "Reforestation can sequester up to 10Gt CO2 annually", delib: "Conservation Strategies", score: 68, claims: 11 },
];

const MOCK_INTERPRETATIONS = [
  { id: "i1", text: "Supports immediate policy intervention", votes: 12, author: "Dr. Smith" },
  { id: "i2", text: "Emphasizes ecosystem-focused approach", votes: 8, author: "Prof. Chen" },
  { id: "i3", text: "Implies urgency over economic concerns", votes: 5, author: "Dr. Garcia" },
];

const GRAPH_NODES = [
  { id: "A1", label: "Climate Thesis", type: "argument", x: 20, y: 25, color: "#6366f1" },
  { id: "A2", label: "Policy Response", type: "argument", x: 55, y: 15, color: "#6366f1" },
  { id: "A3", label: "Economic Impact", type: "argument", x: 75, y: 45, color: "#6366f1" },
  { id: "D1", label: "Climate Debate", type: "deliberation", x: 40, y: 55, color: "#8b5cf6" },
  { id: "S1", label: "IPCC Report", type: "source", x: 15, y: 70, color: "#3b82f6" },
  { id: "U1", label: "Dr. Smith", type: "author", x: 70, y: 75, color: "#f59e0b" },
];

const GRAPH_EDGES = [
  { from: "A1", to: "A2", label: "supports" },
  { from: "A3", to: "A1", label: "extends" },
  { from: "A1", to: "D1", label: "belongs to" },
  { from: "A2", to: "D1", label: "belongs to" },
  { from: "S1", to: "A1", label: "source of" },
  { from: "U1", to: "A2", label: "authored" },
  { from: "U1", to: "A3", label: "authored" },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE PHASES
// ─────────────────────────────────────────────────────────────────────────────

const PHASES = [
  {
    id: "phase1",
    title: "Phase 1: Core Academic Infrastructure",
    description: "Foundation for academic deliberation",
    features: [
      {
        id: "paper-pipeline",
        title: "Paper-to-Claim Pipeline",
        description: "Upload academic papers and extract claims with proper source attribution",
        icon: Upload,
        phase: "Phase 1.1",
        status: "complete" as const,
        items: ["PDF upload & text extraction", "AI-powered claim extraction", "Automatic source linking", "Academic claim classification"],
      },
      {
        id: "claim-search",
        title: "Claim-Based Search",
        description: "Discover related claims across deliberations",
        icon: Search,
        phase: "Phase 1.2",
        status: "complete" as const,
        items: ["PostgreSQL text search", "Keyword scoring", "Related claims discovery", "Challenge detection"],
      },
    ],
  },
  {
    id: "phase2",
    title: "Phase 2: Versioning & Memory",
    description: "Track evolution and enable collaboration",
    features: [
      {
        id: "releases",
        title: "Debate Releases & Versioning",
        description: "Create citable, versioned snapshots of deliberation state",
        icon: History,
        phase: "Phase 2.1",
        status: "complete" as const,
        items: ["Semantic versioning (major.minor.patch)", "Point-in-time snapshots", "Changelog generation", "BibTeX citations"],
      },
      {
        id: "forks",
        title: "Forks & Merges",
        description: "Branch deliberations and merge contributions",
        icon: GitBranch,
        phase: "Phase 2.2",
        status: "complete" as const,
        items: ["Fork deliberations", "Merge requests", "Conflict resolution", "Contribution tracking"],
      },
    ],
  },
  {
    id: "phase3",
    title: "Phase 3: Scholarly Infrastructure",
    description: "Full academic citation and export support",
    features: [
      {
        id: "provenance",
        title: "Provenance & Challenges",
        description: "Track claim history, attacks, and defenses",
        icon: Shield,
        phase: "Phase 3.1",
        status: "complete" as const,
        items: ["Version history", "Attack/defense tracking", "Consensus indicators", "Canonical claims"],
      },
      {
        id: "exports",
        title: "Export Formats",
        description: "Export deliberations in academic formats",
        icon: Download,
        phase: "Phase 3.2",
        status: "complete" as const,
        items: ["BibTeX export", "RIS export", "Markdown with TOC", "PDF generation"],
      },
      {
        id: "citations",
        title: "Argument Citations",
        description: "Cite specific arguments with stable permalinks",
        icon: Link2,
        phase: "Phase 3.3",
        status: "complete" as const,
        items: ["Stable permalinks", "8 citation types", "Citation graphs", "APA/MLA/Chicago/BibTeX"],
      },
      {
        id: "quotes",
        title: "Quotes & Interpretations",
        description: "Quote text with structured interpretations",
        icon: Quote,
        phase: "Phase 3.4",
        status: "complete" as const,
        items: ["Quote extraction", "Locator types", "Interpretations", "Voting on interpretations"],
      },
      {
        id: "cross-delib",
        title: "Cross-Deliberation",
        description: "Connect claims across deliberations",
        icon: Globe,
        phase: "Phase 3.5",
        status: "complete" as const,
        items: ["Canonical claim registry", "Cross-room search", "Argument import", "Related deliberations"],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA - CROSS-DELIBERATION
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CROSS_ROOM_CLAIMS = [
  {
    id: "canonical-1",
    text: "Carbon emissions contribute to global warming",
    globalStatus: "ACCEPTED",
    instances: 7,
    deliberations: [
      { id: "d1", title: "Climate Policy Debate" },
      { id: "d2", title: "Energy Policy Forum" },
      { id: "d3", title: "Environmental Impact Study" },
    ],
  },
  {
    id: "canonical-2",
    text: "Renewable energy can fully replace fossil fuels by 2050",
    globalStatus: "CONTESTED",
    instances: 4,
    deliberations: [
      { id: "d2", title: "Energy Policy Forum" },
      { id: "d4", title: "Green Technology Discussion" },
    ],
  },
  {
    id: "canonical-3",
    text: "Nuclear power is essential for meeting climate goals",
    globalStatus: "EMERGING",
    instances: 3,
    deliberations: [
      { id: "d5", title: "Nuclear Energy Debate" },
      { id: "d2", title: "Energy Policy Forum" },
    ],
  },
];

const MOCK_RELATED_DELIBS = [
  { id: "rd1", title: "Energy Policy Forum", sharedClaims: 12, relationship: 0.85 },
  { id: "rd2", title: "Environmental Impact Study", sharedClaims: 8, relationship: 0.62 },
  { id: "rd3", title: "Green Technology Discussion", sharedClaims: 5, relationship: 0.41 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 1: OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof PHASES)[0]["features"][0] }) {
  const Icon = feature.icon;

  return (
    <Card className="h-full bg-indigo-50/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {feature.title}
                <Badge className="bg-indigo-600 text-xs">{feature.phase}</Badge>
              </CardTitle>
              <CardDescription className="text-sm">{feature.description}</CardDescription>
            </div>
          </div>
          <Badge variant="default" className="bg-green-600 shrink-0">
            <Check className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {feature.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <Check className="w-3 h-3 text-green-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 2: PIPELINE & SEARCH (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

function PaperPipelineDemo() {
  const [stage, setStage] = useState<"idle" | "uploading" | "extracting" | "done">("idle");
  const [extractedClaims, setExtractedClaims] = useState<typeof MOCK_EXTRACTED_CLAIMS>([]);

  const handleUpload = async () => {
    setStage("uploading");
    toast.info("Uploading paper...", { description: "Processing IPCC_Report_2025.pdf" });
    await new Promise((r) => setTimeout(r, 1200));

    setStage("extracting");
    toast.info("Extracting claims...", { description: "AI analyzing paper content" });
    await new Promise((r) => setTimeout(r, 1500));

    setExtractedClaims(MOCK_EXTRACTED_CLAIMS);
    setStage("done");
    toast.success("Extraction Complete", {
      description: `${MOCK_EXTRACTED_CLAIMS.length} claims extracted from paper`,
    });
  };

  const handleReset = () => {
    setStage("idle");
    setExtractedClaims([]);
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Paper-to-Claim Pipeline
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 1.1</Badge>
        </CardTitle>
        <CardDescription>
          Upload academic papers and extract claims with AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
            stage === "idle"
              ? "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer"
              : "border-indigo-300 bg-indigo-50"
          }`}
          onClick={stage === "idle" ? handleUpload : undefined}
        >
          {stage === "idle" && (
            <>
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium">Click to upload a paper</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, or plain text</p>
            </>
          )}
          {stage === "uploading" && (
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-sm font-medium text-indigo-700">Uploading paper...</span>
            </div>
          )}
          {stage === "extracting" && (
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-sm font-medium text-indigo-700">AI extracting claims...</span>
            </div>
          )}
          {stage === "done" && (
            <div className="flex items-center justify-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {extractedClaims.length} claims extracted
              </span>
            </div>
          )}
        </div>

        {/* Extracted Claims */}
        {extractedClaims.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Extracted Claims:</p>
            {extractedClaims.map((claim) => (
              <div key={claim.id} className="p-3 border rounded-lg bg-white">
                <div className="flex items-start justify-between">
                  <p className="text-sm flex-1">{claim.text}</p>
                  <Badge
                    variant="outline"
                    className={`ml-2 shrink-0 text-xs ${
                      claim.confidence >= 0.9
                        ? "text-green-700 border-green-300"
                        : claim.confidence >= 0.8
                        ? "text-amber-700 border-amber-300"
                        : "text-red-700 border-red-300"
                    }`}
                  >
                    {Math.round(claim.confidence * 100)}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Page {claim.page}</p>
              </div>
            ))}
          </div>
        )}

        {stage === "done" && (
          <button
            className="text-xs text-indigo-600 hover:underline"
            onClick={handleReset}
          >
            Reset demo
          </button>
        )}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Paper processing pipeline at{" "}
            <code className="bg-green-100 px-1 rounded">lib/papers/extractClaims.ts</code> •
            Upload API at <code className="bg-green-100 px-1 rounded">/api/papers/upload</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ClaimSearchDemo() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<typeof MOCK_SEARCH_RESULTS>([]);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    toast.info("Searching claims...", { description: `Query: "${query}"` });
    await new Promise((r) => setTimeout(r, 1000));

    setResults(MOCK_SEARCH_RESULTS);
    setSearching(false);
    toast.success(`${MOCK_SEARCH_RESULTS.length} results found`);
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Claim-Based Search
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 1.2</Badge>
        </CardTitle>
        <CardDescription>
          Discover related claims across all deliberations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search for claims (e.g. &quot;climate policy&quot;)..."
            className="flex-1 px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <Button
            size="sm"
            disabled={searching || !query.trim()}
            onClick={handleSearch}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {searching ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((result) => {
              const isSelected = selectedResult === result.id;
              return (
                <div key={result.id}>
                  <button
                    className={`w-full flex items-center justify-between p-3 border rounded-lg transition-all text-left ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                        : "bg-white hover:border-slate-300"
                    }`}
                    onClick={() => {
                      setSelectedResult(isSelected ? null : result.id);
                      if (!isSelected) {
                        toast.info(result.text, {
                          description: `${result.score}% match • ${result.delib}`,
                        });
                      }
                    }}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{result.text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{result.delib}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${result.score}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">{result.score}%</span>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transition-transform ${isSelected ? "rotate-90" : ""}`}
                      />
                    </div>
                  </button>
                  {isSelected && (
                    <div className="mt-1 ml-4 p-3 bg-slate-50 border rounded-lg text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {result.claims} related claims in this deliberation
                        </span>
                        <Button variant="outline" size="sm" className="h-6 text-xs">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> PostgreSQL full-text search at{" "}
            <code className="bg-green-100 px-1 rounded">lib/search/claimSearch.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/claims/search</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 3: VERSIONING (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

function ReleasesDemo() {
  const [selectedRelease, setSelectedRelease] = useState("v2.1.0");

  const RELEASES = [
    {
      version: "v2.1.0",
      title: "Climate Policy Consensus",
      date: "Feb 1, 2026",
      author: "Dr. Jane Smith",
      stats: "42 claims • 18 arguments",
      latest: true,
      changes: [
        "Added 5 new claims from economic analysis",
        "Resolved 3 merge conflicts from community fork",
        "Updated consensus status on 2 contested claims",
      ],
    },
    {
      version: "v2.0.0",
      title: "Major Restructure",
      date: "Jan 20, 2026",
      author: "Prof. Alex Chen",
      stats: "37 claims • 15 arguments",
      latest: false,
      changes: [
        "Reorganized argument hierarchy",
        "Added renewable energy analysis branch",
        "Merged community contributions from 3 forks",
      ],
    },
    {
      version: "v1.0.0",
      title: "Initial Publication",
      date: "Jan 3, 2026",
      author: "Dr. Jane Smith",
      stats: "24 claims • 10 arguments",
      latest: false,
      changes: ["Initial deliberation publication", "Core thesis and supporting arguments"],
    },
  ];

  const active = RELEASES.find((r) => r.version === selectedRelease)!;

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Debate Releases
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 2.1</Badge>
        </CardTitle>
        <CardDescription>
          Versioned, citable snapshots of deliberation state
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Release Selector */}
        <div className="flex gap-2">
          {RELEASES.map((r) => (
            <button
              key={r.version}
              onClick={() => {
                setSelectedRelease(r.version);
                toast.info(`Viewing ${r.version}`, { description: r.title });
              }}
              className={`flex-1 p-2 text-center border rounded-lg text-xs transition-all ${
                selectedRelease === r.version
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                  : "bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-mono font-bold">{r.version}</p>
              <p className="text-muted-foreground mt-0.5">{r.date}</p>
            </button>
          ))}
        </div>

        {/* Selected Release Detail */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="font-mono">{active.version}</Badge>
              <span className="text-sm font-medium">{active.title}</span>
            </div>
            {active.latest && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                Latest
              </Badge>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>📅 {active.date}</span>
              <span>👤 {active.author}</span>
              <span>📝 {active.stats}</span>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">Changelog:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {active.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.success("Export Started", {
                    description: `Downloading ${active.version} as BibTeX...`,
                  })
                }
              >
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Smith, J. et al. (2026). ${active.title} ${active.version}. Mesh. https://mesh.app/d/climate-policy/${active.version}`
                  );
                  toast.success("Citation Copied", {
                    description: "APA citation copied to clipboard",
                  });
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Cite
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.info("Opening Release", {
                    description: `Navigating to ${active.version} snapshot...`,
                  })
                }
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View
              </Button>
            </div>
          </div>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Release service at{" "}
            <code className="bg-green-100 px-1 rounded">lib/releases/releaseService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/deliberations/[id]/releases</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ForksDemo() {
  const [forkCreated, setForkCreated] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const handleFork = async () => {
    toast.info("Creating fork...");
    await new Promise((r) => setTimeout(r, 1000));
    setForkCreated(true);
    toast.success("Fork Created", {
      description: "New branch 'my-analysis' created from Climate Policy Debate",
    });
  };

  const handleMerge = async () => {
    toast.info("Opening merge request...");
    await new Promise((r) => setTimeout(r, 800));
    setMergeOpen(true);
    toast.success("Merge Request Opened", {
      description: "Draft merge request created. Reviewers notified.",
    });
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Forks & Merges
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 2.2</Badge>
        </CardTitle>
        <CardDescription>
          Branch deliberations and merge contributions back
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fork Visualization */}
        <div className="flex items-center gap-4">
          <div className="flex-1 border rounded-lg p-3 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">main</Badge>
              <span className="text-sm font-medium">Climate Policy Debate</span>
            </div>
            <p className="text-xs text-slate-500">42 claims • 18 arguments</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          <div
            className={`flex-1 border rounded-lg p-3 transition-all ${
              forkCreated
                ? "border-green-300 bg-green-50"
                : "border-purple-200 bg-purple-50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge className={forkCreated ? "bg-green-600" : "bg-purple-600"}>
                {forkCreated ? "forked" : "fork"}
              </Badge>
              <span className="text-sm font-medium">Economic Analysis Branch</span>
            </div>
            <p className="text-xs text-slate-500">
              {forkCreated ? "+8 claims • +3 arguments • active" : "+8 claims • +3 arguments"}
            </p>
          </div>
        </div>

        {/* Merge Status */}
        {mergeOpen && (
          <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-700">Merge Request #1</p>
              <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                Open
              </Badge>
            </div>
            <p className="text-xs text-amber-600 mt-1">
              Economic Analysis Branch → main • 2 reviewers assigned
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={forkCreated}
            onClick={handleFork}
          >
            <GitBranch className="w-3 h-3 mr-1" />
            {forkCreated ? "Fork Created" : "Create Fork"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={mergeOpen}
            onClick={handleMerge}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            {mergeOpen ? "MR Opened" : "Open Merge Request"}
          </Button>
          {(forkCreated || mergeOpen) && (
            <button
              className="text-xs text-indigo-600 hover:underline ml-2 self-center"
              onClick={() => {
                setForkCreated(false);
                setMergeOpen(false);
                toast.info("Demo reset");
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Git-style flow diagram */}
        <div className="p-3 bg-slate-50 border rounded-lg text-xs text-center space-y-1">
          <p className="font-medium text-slate-700">Contribution Flow</p>
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <span className="px-2 py-0.5 bg-white border rounded">Fork</span>
            <ArrowRight className="w-3 h-3" />
            <span className="px-2 py-0.5 bg-white border rounded">Edit Claims</span>
            <ArrowRight className="w-3 h-3" />
            <span className="px-2 py-0.5 bg-white border rounded">Open MR</span>
            <ArrowRight className="w-3 h-3" />
            <span className="px-2 py-0.5 bg-white border rounded">Review</span>
            <ArrowRight className="w-3 h-3" />
            <span className="px-2 py-0.5 bg-green-50 border border-green-300 text-green-700 rounded">Merge</span>
          </div>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Fork/merge at{" "}
            <code className="bg-green-100 px-1 rounded">lib/forks/forkService.ts</code> •
            Components at <code className="bg-green-100 px-1 rounded">components/forks/</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 4: PROVENANCE & CHALLENGES (Phase 3.1)
// ─────────────────────────────────────────────────────────────────────────────

function ProvenanceDemo() {
  const [consensusStatus, setConsensusStatus] = useState<"contested" | "emerging" | "established">("emerging");
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const VERSIONS = [
    { version: "1.2.0", date: "Feb 1, 2026", change: "Major revision — added economic data", type: "major" as const },
    { version: "1.1.0", date: "Jan 25, 2026", change: "Added supporting evidence", type: "minor" as const },
    { version: "1.0.0", date: "Jan 15, 2026", change: "Initial version published", type: "initial" as const },
  ];

  const CHALLENGES = [
    { id: "ch1", type: "attack", label: "Methodology Questioned", status: "active", author: "Prof. Lee" },
    { id: "ch2", type: "attack", label: "Sample Size Too Small", status: "active", author: "Dr. Patel" },
    { id: "ch3", type: "defense", label: "Replicated in Follow-up Study", status: "defended", author: "Dr. Smith" },
    { id: "ch4", type: "defense", label: "Peer Review Confirms Findings", status: "defended", author: "Prof. Chen" },
    { id: "ch5", type: "defense", label: "Additional Data Added", status: "defended", author: "Dr. Garcia" },
    { id: "ch6", type: "attack", label: "Economic Projections Uncertain", status: "pending", author: "Dr. Kim" },
  ];

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Provenance & Challenges
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.1</Badge>
        </CardTitle>
        <CardDescription>
          Track claim history, attacks, defenses, and consensus
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consensus Toggle */}
        <div>
          <p className="text-sm font-medium mb-2">Consensus Status:</p>
          <div className="flex gap-2">
            {(["contested", "emerging", "established"] as const).map((status) => {
              const colors = {
                contested: "bg-red-100 text-red-700 ring-red-300",
                emerging: "bg-amber-100 text-amber-700 ring-amber-300",
                established: "bg-green-100 text-green-700 ring-green-300",
              };
              return (
                <button
                  key={status}
                  onClick={() => {
                    setConsensusStatus(status);
                    toast.info(`Consensus: ${status.charAt(0).toUpperCase() + status.slice(1)}`);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    consensusStatus === status
                      ? `${colors[status]} ring-2 ring-offset-1`
                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Version Timeline */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Version Timeline:</p>
          <div className="space-y-2">
            {VERSIONS.map((v) => {
              const isSelected = selectedVersion === v.version;
              return (
                <button
                  key={v.version}
                  className={`w-full flex items-center gap-3 text-sm p-2 rounded transition-all text-left ${
                    isSelected
                      ? "bg-indigo-100 ring-1 ring-indigo-300"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    setSelectedVersion(isSelected ? null : v.version);
                    if (!isSelected) {
                      toast.info(`Version ${v.version}`, { description: v.change });
                    }
                  }}
                >
                  <Badge variant="outline" className="font-mono shrink-0">
                    {v.version}
                  </Badge>
                  <span className="text-slate-500 text-xs shrink-0">{v.date}</span>
                  <span className="text-slate-700 text-xs flex-1">{v.change}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Challenge Status */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Challenge Status:</p>
          <div className="grid grid-cols-2 gap-2">
            {CHALLENGES.map((ch) => {
              const styles = {
                active: "bg-red-50 border-red-200 text-red-700",
                defended: "bg-green-50 border-green-200 text-green-700",
                pending: "bg-slate-50 border-slate-200 text-slate-600",
              };
              return (
                <Tooltip key={ch.id}>
                  <TooltipTrigger asChild>
                    <div className={`p-2 border rounded text-xs ${styles[ch.status as keyof typeof styles]}`}>
                      <div className="flex items-center gap-1">
                        {ch.status === "defended" ? (
                          <Check className="w-3 h-3" />
                        ) : ch.status === "active" ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                        <span className="font-medium truncate">{ch.label}</span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {ch.type === "attack" ? "Attack" : "Defense"} by {ch.author} — {ch.status}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-xs mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>2 Active Attacks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span>3 Defended</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span>1 Pending</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Provenance at{" "}
            <code className="bg-green-100 px-1 rounded">lib/provenance/provenanceService.ts</code> •
            Canonical claims at <code className="bg-green-100 px-1 rounded">lib/provenance/canonicalClaimService.ts</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 5: CITATIONS (Phase 3.3)
// ─────────────────────────────────────────────────────────────────────────────

function CitationTypeDemo() {
  const [selectedType, setSelectedType] = useState<ArgCitationType>("SUPPORT");

  const TYPES: ArgCitationType[] = [
    "SUPPORT", "EXTENSION", "APPLICATION", "CONTRAST",
    "REBUTTAL", "REFINEMENT", "METHODOLOGY", "CRITIQUE",
  ];

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Citation Types
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.3</Badge>
        </CardTitle>
        <CardDescription>
          8 distinct citation types for precise scholarly references
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type Selector */}
        <div>
          <p className="text-sm font-medium mb-2">Select a citation type:</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  toast.info(`Type: ${type}`, {
                    description: getCitationTypeDescription(type),
                  });
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedType === type
                    ? `${CITATION_TYPE_COLORS[type]} ring-2 ring-offset-1`
                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Citation Visualization */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Citing Argument:</p>
              <div className="p-3 bg-slate-50 rounded border">
                <p className="text-sm">
                  &ldquo;Renewable energy costs have reached grid parity in most markets.&rdquo;
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-8">
              <Badge className={CITATION_TYPE_COLORS[selectedType]}>
                {selectedType}
              </Badge>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Cited Argument:</p>
              <div className="p-3 bg-slate-50 rounded border">
                <p className="text-sm">
                  &ldquo;Immediate climate action is economically beneficial in the long term.&rdquo;
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-slate-50 rounded">
            <p className="text-sm text-slate-700">
              <strong className="text-indigo-600">{selectedType}:</strong>{" "}
              {getCitationTypeDescription(selectedType)}
            </p>
          </div>
        </div>

        {/* Badge Variants Preview */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Badge variants:</p>
          <div className="flex flex-wrap gap-2">
            <ArgumentCitationBadge type={selectedType} size="xs" />
            <ArgumentCitationBadge type={selectedType} size="sm" />
            <ArgumentCitationBadge type={selectedType} size="md" />
            <ArgumentCitationBadge type={selectedType} size="md" showIcon={false} />
            <ArgumentCitationBadge type={selectedType} size="sm" showLabel={false} />
          </div>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Citation service at{" "}
            <code className="bg-green-100 px-1 rounded">lib/citations/argumentCitationService.ts</code> •
            Components at <code className="bg-green-100 px-1 rounded">components/citations/argument/</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function getCitationTypeDescription(type: ArgCitationType): string {
  const descriptions: Record<ArgCitationType, string> = {
    SUPPORT: "This argument provides evidence that strengthens the cited argument.",
    EXTENSION: "This argument extends or broadens the scope of the cited argument.",
    APPLICATION: "This argument applies the cited argument to a specific context.",
    CONTRAST: "This argument contrasts or compares with the cited argument.",
    REBUTTAL: "This argument rebuts or counters the cited argument.",
    REFINEMENT: "This argument refines or sharpens the cited argument.",
    METHODOLOGY: "This argument relates to the methodology of the cited argument.",
    CRITIQUE: "This argument critiques the reasoning of the cited argument.",
  };
  return descriptions[type];
}

function CitationFormatsDemo() {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("apa");

  const handleCopy = async (format: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    toast.success("Copied to clipboard", { description: `${format.toUpperCase()} citation` });
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Citation Formats
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.3</Badge>
        </CardTitle>
        <CardDescription>
          Generate citations in APA, MLA, Chicago, or BibTeX
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Format Selector */}
        <div className="flex gap-2">
          {CITATION_FORMATS.map((item) => (
            <button
              key={item.format}
              onClick={() => setSelectedFormat(item.format)}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                selectedFormat === item.format
                  ? "bg-indigo-100 text-indigo-700 border-indigo-300 ring-1 ring-indigo-200"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Selected Format Preview */}
        {CITATION_FORMATS.filter((f) => f.format === selectedFormat).map((item) => (
          <div key={item.format} className="border rounded-lg p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{item.label}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(item.format, item.sample)}
              >
                {copiedFormat === item.format ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <pre className="text-xs bg-slate-50 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
              {item.sample}
            </pre>
          </div>
        ))}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Permalink service at{" "}
            <code className="bg-green-100 px-1 rounded">lib/citations/permalinkService.ts</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/arguments/[id]/permalink</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CitationListDemo() {
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Citation Cards
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.3</Badge>
        </CardTitle>
        <CardDescription>
          View citations with type, direction, and context
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {MOCK_CITATIONS.map((citation) => (
          <ArgumentCitationCard
            key={citation.id}
            citation={citation}
            direction="made"
            onArgumentClick={(id) =>
              toast.info("Navigate to Argument", {
                description: `Opening argument ${id.slice(0, 8)}...`,
              })
            }
          />
        ))}
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> API at{" "}
            <code className="bg-green-100 px-1 rounded">/api/arguments/[id]/arg-citations</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CitationGraphDemo() {
  const [selectedNode, setSelectedNode] = useState<(typeof GRAPH_NODES)[0] | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const connectedEdges = selectedNode
    ? GRAPH_EDGES.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
    : [];
  const connectedNodeIds = new Set(connectedEdges.flatMap((e) => [e.from, e.to]));

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5" />
          Citation Graph
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.3</Badge>
        </CardTitle>
        <CardDescription>
          Interactive visualization of argument citation relationships
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini Graph */}
        <div className="border rounded-lg p-4 bg-slate-900 text-white min-h-[200px] relative overflow-hidden">
          {/* Edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            {GRAPH_EDGES.map((edge, i) => {
              const fromNode = GRAPH_NODES.find((n) => n.id === edge.from)!;
              const toNode = GRAPH_NODES.find((n) => n.id === edge.to)!;
              const isHighlighted = selectedNode
                ? edge.from === selectedNode.id || edge.to === selectedNode.id
                : false;
              return (
                <line
                  key={i}
                  x1={`${fromNode.x}%`}
                  y1={`${fromNode.y}%`}
                  x2={`${toNode.x}%`}
                  y2={`${toNode.y}%`}
                  stroke={isHighlighted ? "#818cf8" : "#475569"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeOpacity={selectedNode && !isHighlighted ? 0.2 : 0.6}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {GRAPH_NODES.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isConnected = connectedNodeIds.has(node.id);
            const isHovered = hoveredNode === node.id;
            const dimmed = selectedNode && !isSelected && !isConnected;
            return (
              <Tooltip key={node.id}>
                <TooltipTrigger asChild>
                  <button
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      zIndex: isSelected ? 10 : isHovered ? 5 : 2,
                      opacity: dimmed ? 0.3 : 1,
                    }}
                    onClick={() => {
                      const next = isSelected ? null : node;
                      setSelectedNode(next);
                      if (next) {
                        const edges = GRAPH_EDGES.filter(
                          (e) => e.from === next.id || e.to === next.id
                        );
                        toast.info(next.label, {
                          description: `${edges.length} connection${edges.length !== 1 ? "s" : ""} • ${next.type}`,
                        });
                      }
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    aria-label={`${node.label} (${node.type})`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        isSelected
                          ? "ring-2 ring-white scale-125 border-white"
                          : isHovered
                          ? "scale-110 border-white/60"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: node.color }}
                    >
                      {node.id}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-medium">{node.label}</p>
                  <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex gap-3 text-xs" style={{ zIndex: 3 }}>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-indigo-500" /> Arguments
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-purple-500" /> Deliberations
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500" /> Sources
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-500" /> Authors
            </span>
          </div>
        </div>

        {/* Selected Node Detail */}
        {selectedNode && (
          <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
            <p className="text-sm font-medium text-indigo-700 mb-2">
              Selected: {selectedNode.label}
            </p>
            <div className="space-y-1">
              {connectedEdges.map((edge, i) => {
                const otherNodeId = edge.from === selectedNode.id ? edge.to : edge.from;
                const otherNode = GRAPH_NODES.find((n) => n.id === otherNodeId)!;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: otherNode.color }}
                    />
                    <span className="text-slate-500">{edge.label}</span>
                    <span className="font-medium">{otherNode.label}</span>
                    <Badge variant="outline" className="text-[10px] scale-90">
                      {otherNode.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Graph Stats */}
        <CitationGraphStats graph={MOCK_CITATION_GRAPH} />

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Graph at{" "}
            <code className="bg-green-100 px-1 rounded">/api/arguments/[id]/citation-graph</code> •
            Viewer at <code className="bg-green-100 px-1 rounded">components/citations/argument/ArgumentCitationGraphViewer</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 6: EXPORTS (Phase 3.2)
// ─────────────────────────────────────────────────────────────────────────────

function ExportFormatsDemo() {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExport = async (formatId: string, formatLabel: string) => {
    setIsExporting(formatId);
    toast.info(`Exporting as ${formatLabel}...`, {
      description: "Export API is fully implemented at /api/deliberations/[id]/export",
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success(`Export Ready: ${formatLabel}`, {
      description: `API endpoint: /api/deliberations/{id}/export?format=${formatId}`,
      duration: 4000,
    });
    setIsExporting(null);
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Formats
          <Badge variant="default" className="ml-2 bg-green-600 text-xs">
            API Ready
          </Badge>
          <Badge className="ml-1 bg-indigo-600 text-xs">Phase 3.2</Badge>
        </CardTitle>
        <CardDescription>
          Export deliberations and arguments in various formats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {MOCK_EXPORT_FORMATS.map((format) => {
            const Icon = format.icon;
            const isLoading = isExporting === format.id;
            return (
              <button
                key={format.id}
                disabled={isLoading}
                className="flex items-center gap-3 p-3 border rounded-lg bg-white hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                onClick={() => handleExport(format.id, format.label)}
              >
                <div className="p-2 rounded bg-slate-100">
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{format.label}</p>
                  <p className="text-xs text-slate-500">{format.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Fully Implemented:</strong> Export services at{" "}
            <code className="bg-green-100 px-1 rounded">lib/exports/</code> with API at{" "}
            <code className="bg-green-100 px-1 rounded">/api/deliberations/[id]/export</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 7: QUOTES & INTERPRETATIONS (Phase 3.4)
// ─────────────────────────────────────────────────────────────────────────────

function QuotesDemo() {
  const [votes, setVotes] = useState<Record<string, number>>(
    Object.fromEntries(MOCK_INTERPRETATIONS.map((i) => [i.id, i.votes]))
  );
  const [voted, setVoted] = useState<Set<string>>(new Set());

  const handleVote = (interpId: string, author: string) => {
    if (voted.has(interpId)) {
      setVotes((prev) => ({ ...prev, [interpId]: prev[interpId] - 1 }));
      setVoted((prev) => {
        const next = new Set(prev);
        next.delete(interpId);
        return next;
      });
      toast.info("Vote removed");
    } else {
      setVotes((prev) => ({ ...prev, [interpId]: prev[interpId] + 1 }));
      setVoted((prev) => new Set([...prev, interpId]));
      toast.success("Vote recorded", { description: `Agreed with ${author}'s interpretation` });
    }
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="w-5 h-5" />
          Quotes & Interpretations
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.4</Badge>
        </CardTitle>
        <CardDescription>
          Extract quotes with structured interpretations and voting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quote Block */}
        <div className="border-l-4 border-indigo-400 bg-white p-4 rounded-r-lg">
          <p className="text-sm italic text-slate-700">
            &ldquo;The evidence clearly demonstrates that immediate action is required
            to prevent irreversible damage to global ecosystems.&rdquo;
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <FileText className="w-3 h-3 text-red-500" />
            <span>IPCC Report 2025</span>
            <span>•</span>
            <span>Page 42, Para 3</span>
          </div>
        </div>

        {/* Interpretations with voting */}
        <div>
          <p className="text-sm font-medium mb-2">Interpretations:</p>
          <div className="space-y-2">
            {MOCK_INTERPRETATIONS.map((interp) => {
              const hasVoted = voted.has(interp.id);
              return (
                <div
                  key={interp.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    hasVoted
                      ? "bg-indigo-50 border-indigo-200"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm">{interp.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">— {interp.author}</p>
                  </div>
                  <button
                    onClick={() => handleVote(interp.id, interp.author)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      hasVoted
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {hasVoted ? <Check className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
                    {votes[interp.id]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Locator Types */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Supported Locator Types:</p>
          <div className="grid grid-cols-3 gap-2">
            {["Page", "Paragraph", "Line", "Chapter", "Section", "Timestamp"].map((loc) => (
              <div
                key={loc}
                className="px-3 py-1.5 bg-white border rounded text-center text-xs font-medium"
              >
                {loc}
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Quote models with interpretation voting •
            Components at <code className="bg-green-100 px-1 rounded">components/quotes/</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - CROSS-DELIBERATION (Phase 3.5)
// ─────────────────────────────────────────────────────────────────────────────

function CrossRoomSearchDemo() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<typeof MOCK_CROSS_ROOM_CLAIMS>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (query.length < 2) return;
    setIsSearching(true);
    await new Promise((r) => setTimeout(r, 800));
    setResults(
      MOCK_CROSS_ROOM_CLAIMS.filter((c) =>
        c.text.toLowerCase().includes(query.toLowerCase())
      )
    );
    setIsSearching(false);
    toast.success("Search Complete", {
      description: `Found ${results.length} canonical claims`,
    });
  };

  const statusColors: Record<string, string> = {
    ACCEPTED: "bg-green-100 text-green-700",
    EMERGING: "bg-blue-100 text-blue-600",
    CONTESTED: "bg-amber-100 text-amber-700",
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Cross-Room Search
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.5</Badge>
        </CardTitle>
        <CardDescription>
          Search claims across all deliberations via canonical registry
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search claims across deliberations..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching || query.length < 2}>
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.map((claim) => (
              <div
                key={claim.id}
                className="p-3 bg-white rounded-lg border hover:border-indigo-300 transition cursor-pointer"
              >
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {claim.text}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Users className="w-3 h-3" />
                    <span>{claim.instances} deliberation(s)</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      statusColors[claim.globalStatus] || "bg-gray-100"
                    }`}
                  >
                    {claim.globalStatus}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {claim.deliberations.slice(0, 2).map((d) => (
                    <span
                      key={d.id}
                      className="text-xs px-2 py-0.5 bg-gray-100 rounded"
                    >
                      {d.title}
                    </span>
                  ))}
                  {claim.deliberations.length > 2 && (
                    <span className="text-xs text-gray-400">
                      +{claim.deliberations.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {query.length > 0 && query.length < 2 && (
          <p className="text-center text-sm text-gray-500">Type at least 2 characters</p>
        )}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Cross-room search via canonical claim registry •
            API at <code className="bg-green-100 px-1 rounded">/api/cross-room-search</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RelatedDeliberationsDemo() {
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5" />
          Related Deliberations
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.5</Badge>
        </CardTitle>
        <CardDescription>
          Find deliberations that share canonical claims
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {MOCK_RELATED_DELIBS.map((delib) => (
            <div
              key={delib.id}
              className="p-3 bg-white rounded-lg border hover:border-indigo-300 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">
                  {delib.title}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    delib.relationship > 0.7
                      ? "bg-green-100 text-green-700"
                      : delib.relationship > 0.4
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {(delib.relationship * 100).toFixed(0)}% related
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <FileText className="w-3 h-3" />
                <span>{delib.sharedClaims} shared claims</span>
              </div>
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${delib.relationship * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Related deliberations discovery •
            API at <code className="bg-green-100 px-1 rounded">/api/deliberations/[id]/related</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ArgumentImportDemo() {
  const [importType, setImportType] = useState<string>("FULL");
  const [isImporting, setIsImporting] = useState(false);

  const importTypes = [
    { id: "FULL", label: "Full Import", description: "Complete argument with premises" },
    { id: "PREMISES_ONLY", label: "Premises Only", description: "Import premises, write new conclusion" },
    { id: "SKELETON", label: "Structure", description: "Import argument structure only" },
    { id: "REFERENCE", label: "Reference", description: "Just cite, don't copy" },
  ];

  const handleImport = async () => {
    setIsImporting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsImporting(false);
    toast.success("Argument Imported", {
      description: `${importType} import complete with full provenance`,
    });
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Import className="w-5 h-5" />
          Argument Import
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.5</Badge>
        </CardTitle>
        <CardDescription>
          Import arguments from other deliberations with provenance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source argument preview */}
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-xs text-gray-500 mb-1">Source Argument:</p>
          <p className="text-sm text-gray-900">
            &ldquo;Carbon pricing mechanisms effectively reduce emissions while maintaining
            economic growth.&rdquo;
          </p>
          <p className="text-xs text-gray-500 mt-1">
            from <span className="text-indigo-600">Energy Policy Forum</span>
          </p>
        </div>

        {/* Import type selection */}
        <div>
          <p className="text-sm font-medium mb-2">Import Type:</p>
          <div className="grid grid-cols-2 gap-2">
            {importTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setImportType(type.id)}
                className={`p-3 rounded-lg border text-left transition ${
                  importType === type.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    importType === type.id ? "text-indigo-700" : "text-gray-900"
                  }`}
                >
                  {type.label}
                </p>
                <p className="text-xs text-gray-500">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleImport} disabled={isImporting} className="w-full">
          {isImporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Importing...
            </>
          ) : (
            <>
              <Import className="w-4 h-4 mr-2" />
              Import Argument
            </>
          )}
        </Button>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> 4 import types with full provenance tracking •
            API at <code className="bg-green-100 px-1 rounded">/api/arguments/[id]/import</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AcademicFeaturesDemo() {
  return (
    <TooltipProvider>
      <Toaster position="top-right" richColors closeButton />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Sticky Header */}
        <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Academic Features Demo</h1>
                  <p className="text-sm text-muted-foreground">
                    Phase 1-3.5 Scholarly Deliberation Infrastructure
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="w-3 h-3 mr-1" />
                  All Features Complete
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Introduction Card */}
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-white shadow-sm">
                  <Scale className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-indigo-900">
                    Scholarly Deliberation Infrastructure
                  </h2>
                  <p className="text-indigo-700 mt-1">
                    Complete academic features for citations, versioning, provenance tracking,
                    and scholarly exports. Upload papers, extract claims, cite arguments with
                    stable permalinks, track consensus, and export in academic formats.
                  </p>
                  <div className="flex gap-6 mt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">3/3</p>
                      <p className="text-xs text-indigo-600">Phases Complete</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">8</p>
                      <p className="text-xs text-indigo-600">Features</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">8</p>
                      <p className="text-xs text-indigo-600">Citation Types</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">4</p>
                      <p className="text-xs text-indigo-600">Export Formats</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="flex w-full justify-start p-1 h-auto">
              <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
              <TabsTrigger value="pipeline" className="text-sm">Pipeline</TabsTrigger>
              <TabsTrigger value="versioning" className="text-sm">Versioning</TabsTrigger>
              <TabsTrigger value="citations" className="text-sm">Citations</TabsTrigger>
              <TabsTrigger value="provenance" className="text-sm">Provenance</TabsTrigger>
              <TabsTrigger value="exports" className="text-sm">Exports</TabsTrigger>
              <TabsTrigger value="quotes" className="text-sm">Quotes</TabsTrigger>
              <TabsTrigger value="cross-delib" className="text-sm">Cross-Delib</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {PHASES.map((phase) => (
                <div key={phase.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-lg font-semibold">{phase.title}</h3>
                    <Badge variant="outline">{phase.description}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {phase.features.map((feature) => (
                      <FeatureCard key={feature.id} feature={feature} />
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Pipeline Tab (Phase 1) */}
            <TabsContent value="pipeline" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Core Academic Infrastructure{" "}
                  <Badge variant="outline" className="ml-2">Phase 1</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Upload papers, extract claims with AI, and discover related arguments across all deliberations.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PaperPipelineDemo />
                <ClaimSearchDemo />
              </div>
            </TabsContent>

            {/* Versioning Tab (Phase 2) */}
            <TabsContent value="versioning" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Versioning & Collaboration{" "}
                  <Badge variant="outline" className="ml-2">Phase 2</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Create citable releases, fork deliberations for independent analysis, and merge contributions back.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ReleasesDemo />
                <ForksDemo />
              </div>
            </TabsContent>

            {/* Citations Tab (Phase 3.3) */}
            <TabsContent value="citations" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Argument Citations{" "}
                  <Badge variant="outline" className="ml-2">Phase 3.3</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Cite specific arguments with stable permalinks, 8 citation types, and academic format generation.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CitationTypeDemo />
                <CitationFormatsDemo />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CitationListDemo />
                <CitationGraphDemo />
              </div>
            </TabsContent>

            {/* Provenance Tab (Phase 3.1) */}
            <TabsContent value="provenance" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Provenance & Challenges{" "}
                  <Badge variant="outline" className="ml-2">Phase 3.1</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Track claim version history, active challenges (attacks and defenses), and consensus status indicators.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <ProvenanceDemo />
              </div>

              {/* Provenance Implementation Reference */}
              <Card className="bg-slate-800 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Provenance Implementation Reference
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">Services</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> provenanceService.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> canonicalClaimService.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> challengeService.ts</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">Data Models</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> CanonicalClaim</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> ClaimVersion</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> ConsensusStatus</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">API Routes</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/claims/[id]/challenges</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/claims/[id]/provenance</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Exports Tab (Phase 3.2) */}
            <TabsContent value="exports" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Export & Portability{" "}
                  <Badge variant="outline" className="ml-2">Phase 3.2</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Export deliberations as BibTeX, RIS, Markdown, or PDF for academic citations and cross-platform portability.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ExportFormatsDemo />
                <Card className="bg-indigo-50/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Export Implementation Reference
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="font-semibold text-indigo-600 mb-2">Export Services</p>
                        <ul className="space-y-1 font-mono text-xs text-slate-600">
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> lib/exports/bibtexService.ts</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> lib/exports/risService.ts</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> lib/exports/markdownService.ts</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> lib/exports/pdfService.ts</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-indigo-600 mb-2">API</p>
                        <ul className="space-y-1 font-mono text-xs text-slate-600">
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/deliberations/[id]/export</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> ?format=bibtex|ris|markdown|pdf</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> ?includeTOC=true</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Quotes Tab (Phase 3.4) */}
            <TabsContent value="quotes" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Quotes & Interpretations{" "}
                  <Badge variant="outline" className="ml-2">Phase 3.4</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Extract precise quotes from sources with structured locators, multiple interpretations, and community voting.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <QuotesDemo />
              </div>
            </TabsContent>

            {/* Cross-Deliberation Tab (Phase 3.5) */}
            <TabsContent value="cross-delib" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">
                  Cross-Deliberation Claim Mapping{" "}
                  <Badge variant="outline" className="ml-2">Phase 3.5</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Connect claims across deliberations with a canonical registry, cross-room search, and argument import.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CrossRoomSearchDemo />
                <RelatedDeliberationsDemo />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ArgumentImportDemo />
                <Card className="bg-indigo-50/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Cross-Deliberation Implementation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="font-semibold text-indigo-600 mb-2">Services</p>
                        <ul className="space-y-1 font-mono text-xs text-slate-600">
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> lib/crossDeliberation/canonicalRegistryService.ts</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> lib/crossDeliberation/crossRoomSearchService.ts</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> lib/crossDeliberation/argumentTransportService.ts</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> lib/crossDeliberation/hooks.ts</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-indigo-600 mb-2">API Routes</p>
                        <ul className="space-y-1 font-mono text-xs text-slate-600">
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/canonical-claims</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/cross-room-search</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/arguments/[id]/import</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/deliberations/[id]/related</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-indigo-600 mb-2">UI Components</p>
                        <ul className="space-y-1 font-mono text-xs text-slate-600">
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> CrossRoomSearchPanel.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> ArgumentImportModal.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> CrossDeliberationTab.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> CanonicalClaimBadge.tsx</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Complete Implementation Reference */}
          <Card className="bg-slate-800 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Complete Implementation Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="font-semibold mb-2 text-indigo-300">Key Services</p>
                  <ul className="space-y-1 text-slate-300 font-mono text-xs">
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/citations/argumentCitationService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/citations/permalinkService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/exports/bibtexService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/releases/releaseService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/provenance/provenanceService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/provenance/canonicalClaimService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/crossDeliberation/crossRoomSearchService.ts</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/crossDeliberation/argumentTransportService.ts</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-2 text-indigo-300">API Routes (Live)</p>
                  <ul className="space-y-1 text-slate-300 font-mono text-xs">
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/arguments/[id]/arg-citations</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/arguments/[id]/permalink</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/arguments/[id]/citation-graph</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/deliberations/[id]/export</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/deliberations/[id]/releases</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/claims/[id]/challenges</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/cross-room-search</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/arguments/[id]/import</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold mb-2 text-indigo-300">UI Components</p>
                  <ul className="space-y-1 text-slate-300 font-mono text-xs">
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/citations/argument/</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/exports/</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/provenance/</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/forks/</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/quotes/</li>
                    <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/crossDeliberation/</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Key Integration Points:</strong>{" "}
                  Arguments cite other arguments via <code className="bg-slate-700 px-1 rounded">ArgumentCitation</code> model •
                  Stable permalinks via <code className="bg-slate-700 px-1 rounded">ArgumentPermalink</code> •
                  Exports support <code className="bg-slate-700 px-1 rounded">GET /api/deliberations/&#123;id&#125;/export?format=bibtex&amp;includeTOC=true</code>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-slate-500 pb-8">
            <p>Academic Features Demo • Phase 1-3.5 Complete • Mesh Platform</p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
