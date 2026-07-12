"use client";

/**
 * Stacks Features Demo Page
 * 
 * Interactive demonstration of all Stacks/Library features:
 * 
 * FOUNDATIONAL FEATURES:
 * - Stack CRUD (create, edit, delete stacks)
 * - PDF Upload & Management
 * - Document Ordering (drag-and-drop)
 * - PDF Viewer with Annotations
 * - Stack Discussion Threads
 * - Collaborators & RBAC
 * - Subscriptions
 * 
 * PHASE 1 IMPROVEMENTS (Are.na Parity):
 * - 1.1 StackItem Join Table (multi-stack connections)
 * - 1.2 Block Types (PDF, Link, Text, Video)
 * - 1.3 Connect UI & Contexts Panel
 * - 1.4 Stack Embeds (stacks containing stacks)
 * - 1.5 Visibility Modes (public_open, public_closed, private, unlisted)
 * - 1.6 Export Functionality (ZIP, Markdown, BibTeX)
 * 
 * PHASE 2 IMPROVEMENTS (Evidence UX):
 * - 2.1 Citation Anchors (executable citations)
 * - 2.2 Lift Carries Citations
 * - 2.3 Citation Intent (supports/refutes/context)
 * 
 * PHASE 3 IMPROVEMENTS (Source Trust & Intelligence):
 * - 3.1 Source Freshness & Verification (URL checks, retraction detection)
 * - 3.2 Reference Manager Integration (Zotero, BibTeX import)
 * - 3.3 Cross-Platform Intelligence (usage tracking, provenance)
 * - 3.4.1 Knowledge Graph View (D3 force-directed visualization)
 * - 3.4.2 Related Content Discovery (similarity-based recommendations)
 * - 3.4.3 Timeline View (temporal evidence visualization)
 * 
 * Accessible at: /test/stacks-features
 */

import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  FileText,
  Link2,
  Layers,
  FolderOpen,
  Download,
  Eye,
  Lock,
  Users,
  Globe,
  LinkIcon,
  MessageSquare,
  ArrowUp,
  Quote,
  FileTextIcon,
  VideoIcon,
  PlusCircle,
  GripVertical,
  ExternalLink,
  Check,
  ChevronRight,
  BookOpen,
  ArrowUpRight,
  FolderIcon,
  FileJsonIcon,
  Settings,
  UserPlus,
  Bell,
  Highlighter,
  Network,
  // Phase 3 icons
  ShieldCheck,
  Archive,
  AlertTriangle,
  LibraryBig,
  Share2,
  GitBranch,
  Calendar,
  Compass,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_STACK = {
  id: "stack-demo-1",
  name: "Climate Research Collection",
  slug: "climate-research-collection",
  description: "A curated collection of climate science papers and resources",
  visibility: "public_closed" as const,
  owner: { id: "user-1", name: "Dr. Jane Smith", username: "jsmith" },
  collaborators: [
    { id: "user-2", name: "Alex Chen", role: "EDITOR" },
    { id: "user-3", name: "Maria Garcia", role: "VIEWER" },
  ],
  _count: { items: 12, subscribers: 45, comments: 23 },
  createdAt: new Date("2025-11-01"),
};

const MOCK_BLOCKS: MockBlock[] = [
  {
    id: "block-1",
    kind: "block",
    blockType: "pdf",
    title: "IPCC Climate Report 2025",
    file_url: "https://example.com/ipcc-2025.pdf",
    thumb_urls: ["/placeholder-thumb.png"],
    connectedStacksCount: 3,
    processingStatus: "done",
  },
  {
    id: "block-2",
    kind: "block",
    blockType: "link",
    title: "NASA Climate Data Portal",
    linkUrl: "https://climate.nasa.gov",
    linkDescription: "Official NASA climate data and research portal",
    linkImage: "https://climate.nasa.gov/og-image.jpg",
    linkSiteName: "NASA Climate",
    linkFavicon: "https://climate.nasa.gov/favicon.ico",
    processingStatus: "done",
    connectedStacksCount: 5,
  },
  {
    id: "block-3",
    kind: "block",
    blockType: "text",
    title: "Research Notes: Carbon Cycle",
    textContent: "# Key Findings\\n\\nThe carbon cycle is accelerating...",
    textFormat: "markdown",
    connectedStacksCount: 1,
    processingStatus: "done",
  },
  {
    id: "block-4",
    kind: "block",
    blockType: "video",
    title: "Climate 101: Documentary",
    videoUrl: "https://youtube.com/watch?v=example",
    videoProvider: "youtube",
    videoThumbnail: "/video-thumb.jpg",
    videoDuration: 3600,
    connectedStacksCount: 2,
    processingStatus: "done",
  },
  {
    id: "stack-embed-1",
    kind: "stack_embed",
    embedStack: {
      id: "stack-2",
      name: "Ocean Acidification Studies",
      slug: "ocean-acidification",
      description: "Related research on ocean pH changes",
      owner: { id: "user-2", name: "Alex Chen", username: "achen" },
      _count: { items: 8 },
    },
    note: "See this collection for related ocean research",
    addedBy: { id: "user-1", name: "Dr. Jane Smith" },
    addedAt: "2025-12-15",
  },
];

interface MockBlock {
  id: string;
  kind: "block" | "stack_embed";
  blockType?: "pdf" | "link" | "text" | "video" | "image" | "dataset";
  title?: string;
  file_url?: string;
  thumb_urls?: string[];
  linkUrl?: string;
  linkDescription?: string;
  linkImage?: string;
  linkSiteName?: string;
  linkFavicon?: string;
  textContent?: string;
  textFormat?: string;
  videoUrl?: string;
  videoProvider?: string;
  videoThumbnail?: string;
  videoDuration?: number;
  connectedStacksCount?: number;
  processingStatus?: string;
  embedStack?: {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    owner: { id: string; name: string; username: string };
    _count: { items: number };
  };
  note?: string;
  addedBy?: { id: string; name: string };
  addedAt?: string;
}

const VISIBILITY_OPTIONS = [
  { value: "public_open", label: "Public Open", icon: Globe, description: "Anyone can view and add blocks" },
  { value: "public_closed", label: "Public", icon: Users, description: "Anyone can view; only collaborators can add" },
  { value: "unlisted", label: "Unlisted", icon: LinkIcon, description: "Only people with the link can view" },
  { value: "private", label: "Private", icon: Lock, description: "Only you and collaborators can access" },
];

const EXPORT_FORMATS = [
  { format: "json", label: "JSON", icon: FileJsonIcon, description: "Full data export for automation" },
  { format: "md", label: "Markdown", icon: FileTextIcon, description: "Readable document format" },
  { format: "bibtex", label: "BibTeX", icon: BookOpen, description: "Academic citation format" },
];

const CITATION_INTENTS = [
  { value: "supports", label: "Supports", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "refutes", label: "Refutes", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "context", label: "Context", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "example", label: "Example", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "methodology", label: "Methodology", color: "bg-amber-100 text-amber-700 border-amber-300" },
];

const MOCK_CITATIONS = [
  {
    id: "cit-1",
    locator: "p. 42",
    quote: "Global temperatures have risen by 1.5°C since pre-industrial levels...",
    anchorType: "page",
    intent: "supports",
    source: { title: "IPCC Climate Report 2025", type: "pdf" },
  },
  {
    id: "cit-2",
    locator: "Chapter 3",
    quote: "Ocean acidification poses significant risks to marine ecosystems...",
    anchorType: "annotation",
    intent: "context",
    source: { title: "Marine Biology Review", type: "pdf" },
  },
  {
    id: "cit-3",
    locator: "00:15:32",
    quote: null,
    anchorType: "timestamp",
    intent: "example",
    source: { title: "Climate 101 Documentary", type: "video" },
  },
];

const PHASES = [
  {
    id: "foundational",
    title: "Foundational Features",
    description: "Core stack functionality",
    features: [
      {
        id: "stack-crud",
        title: "Stack Management",
        description: "Create, edit, and organize document collections",
        icon: FolderOpen,
        status: "complete" as const,
        items: ["Create stacks with name & description", "Edit stack settings", "Delete stacks", "Hierarchical organization"],
      },
      {
        id: "pdf-upload",
        title: "PDF Upload & Viewer",
        description: "Upload PDFs with automatic thumbnail generation",
        icon: FileText,
        status: "complete" as const,
        items: ["Multi-file upload", "Automatic thumbnails", "Full-screen PDF viewer", "Page navigation"],
      },
      {
        id: "ordering",
        title: "Drag-and-Drop Ordering",
        description: "Reorder documents within stacks visually",
        icon: GripVertical,
        status: "complete" as const,
        items: ["dnd-kit integration", "Optimistic updates", "Persistent ordering", "Touch support"],
      },
      {
        id: "discussion",
        title: "Stack Discussions",
        description: "FeedPost-based comment threads on stacks",
        icon: MessageSquare,
        status: "complete" as const,
        items: ["Threaded comments", "Citation attachments", "Lift to deliberation", "Real-time updates"],
      },
      {
        id: "collaboration",
        title: "Collaborators & RBAC",
        description: "Role-based access control for team stacks",
        icon: UserPlus,
        status: "complete" as const,
        items: ["Owner/Editor/Viewer roles", "Add collaborators", "Remove access", "Role changes"],
      },
      {
        id: "subscriptions",
        title: "Stack Subscriptions",
        description: "Follow stacks for updates",
        icon: Bell,
        status: "complete" as const,
        items: ["Subscribe/unsubscribe", "Notification integration", "Subscriber counts", "Activity feeds"],
      },
    ],
  },
  {
    id: "phase1",
    title: "Phase 1: Are.na Parity",
    description: "Multi-stack connections and content diversity",
    features: [
      {
        id: "stack-item",
        title: "StackItem Join Table",
        description: "Blocks can appear in unlimited stacks",
        icon: Link2,
        status: "complete" as const,
        items: ["Many-to-many block↔stack", "Connection metadata", "Position-based ordering", "No array rewrites"],
      },
      {
        id: "block-types",
        title: "Block Types",
        description: "Support for multiple content types",
        icon: Layers,
        status: "complete" as const,
        items: ["PDF documents", "Link blocks with OG", "Text/Markdown notes", "Video embeds"],
      },
      {
        id: "connect-ui",
        title: "Connect UI & Contexts",
        description: "Add blocks to multiple stacks with context tracking",
        icon: Network,
        status: "complete" as const,
        items: ["Connect modal", "Contexts panel", "Connection count badges", "Cross-stack discovery"],
      },
      {
        id: "stack-embeds",
        title: "Stack Embeds",
        description: "Embed stacks within other stacks",
        icon: FolderIcon,
        status: "complete" as const,
        items: ["Embedded stack cards", "Notes on embeds", "Circular prevention", "Nested navigation"],
      },
      {
        id: "visibility",
        title: "Visibility Modes",
        description: "Granular access control",
        icon: Eye,
        status: "complete" as const,
        items: ["Public open", "Public closed", "Private", "Unlisted (link-only)"],
      },
      {
        id: "exports",
        title: "Export Functionality",
        description: "Export stacks in various formats",
        icon: Download,
        status: "complete" as const,
        items: ["JSON export", "Markdown export", "BibTeX bibliography", "ZIP archives"],
      },
    ],
  },
  {
    id: "phase2",
    title: "Phase 2: Evidence UX",
    description: "Executable citations and evidence workflows",
    features: [
      {
        id: "citation-anchors",
        title: "Citation Anchors",
        description: "Click citations to jump to exact locations",
        icon: Highlighter,
        status: "complete" as const,
        items: ["PDF page anchors", "Annotation anchors", "Video timestamps", "Text range anchors"],
      },
      {
        id: "lift-citations",
        title: "Lift Carries Citations",
        description: "Comments keep citations when lifted to deliberations",
        icon: ArrowUp,
        status: "complete" as const,
        items: ["Auto-copy citations", "Source preservation", "Evidence chain", "Citation count hint"],
      },
      {
        id: "citation-intent",
        title: "Citation Intent",
        description: "Semantic meaning for citations",
        icon: Quote,
        status: "complete" as const,
        items: ["Supports", "Refutes", "Context", "Example/Methodology"],
      },
    ],
  },
  {
    id: "phase3",
    title: "Phase 3: Source Trust & Intelligence",
    description: "Source verification, reference management, and discovery",
    features: [
      {
        id: "source-verification",
        title: "Source Freshness & Verification",
        description: "Monitor source health with automated checks",
        icon: ShieldCheck,
        status: "complete" as const,
        items: ["URL verification", "Retraction detection", "Archive integration", "Source alerts"],
      },
      {
        id: "reference-manager",
        title: "Reference Manager Integration",
        description: "Import from Zotero, Mendeley, and more",
        icon: LibraryBig,
        status: "complete" as const,
        items: ["Zotero import", "BibTeX import", "Auto-metadata", "Bulk import"],
      },
      {
        id: "cross-platform",
        title: "Cross-Platform Intelligence",
        description: "Track source usage across deliberations",
        icon: Share2,
        status: "complete" as const,
        items: ["Usage tracking", "Citation contexts", "Evidence provenance", "Trust scoring"],
      },
      {
        id: "knowledge-graph",
        title: "Knowledge Graph View",
        description: "Explore connections between sources and topics",
        icon: GitBranch,
        status: "complete" as const,
        items: ["Interactive graph", "Node filtering", "BFS traversal", "Topic clusters"],
      },
      {
        id: "related-content",
        title: "Related Content",
        description: "Discover related deliberations and stacks",
        icon: Compass,
        status: "complete" as const,
        items: ["Related deliberations", "Related stacks", "Related sources", "Similarity scoring"],
      },
      {
        id: "timeline-view",
        title: "Timeline View",
        description: "Temporal visualization of evidence evolution",
        icon: Calendar,
        status: "complete" as const,
        items: ["Publication dates", "Citation events", "Retraction alerts", "Year grouping"],
      },
    ],
  },
];

// Phase 3 Mock Data
const MOCK_SOURCE_ALERTS = [
  {
    id: "alert-1",
    type: "retraction",
    sourceTitle: "Hydroxychloroquine Study 2020",
    message: "This paper has been retracted by the publisher",
    severity: "critical",
    date: "2025-12-01",
  },
  {
    id: "alert-2",
    type: "broken_link",
    sourceTitle: "Climate Data Portal",
    message: "URL returned 404 - source may have moved",
    severity: "warning",
    date: "2025-12-10",
  },
  {
    id: "alert-3",
    type: "correction",
    sourceTitle: "Ocean Temperature Analysis",
    message: "Authors published correction to methodology",
    severity: "info",
    date: "2025-12-15",
  },
];

const MOCK_TIMELINE_EVENTS = [
  { id: "evt-1", type: "source_published", year: 2020, title: "IPCC Report Published", color: "#3b82f6" },
  { id: "evt-2", type: "source_cited", year: 2021, title: "Cited in Climate Deliberation", color: "#10b981" },
  { id: "evt-3", type: "argument_created", year: 2022, title: "New argument added", color: "#8b5cf6" },
  { id: "evt-4", type: "retraction", year: 2023, title: "Related study retracted", color: "#ef4444" },
  { id: "evt-5", type: "source_cited", year: 2024, title: "Cited in 3 new deliberations", color: "#10b981" },
  { id: "evt-6", type: "source_published", year: 2025, title: "Follow-up study published", color: "#3b82f6" },
];

const MOCK_RELATED_ITEMS = [
  { id: "rel-1", type: "deliberation", title: "Carbon Capture Technology", score: 85, reason: "3 shared sources" },
  { id: "rel-2", type: "deliberation", title: "Renewable Energy Policy", score: 72, reason: "2 shared topics" },
  { id: "rel-3", type: "stack", title: "Ocean Research Collection", score: 68, reason: "45% source overlap" },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 1
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: typeof PHASES[0]["features"][0] }) {
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

function StackPreviewCard() {
  const [visibility, setVisibility] = useState<string>("public_closed");
  
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Stack Preview
        </CardTitle>
        <CardDescription>
          Interactive stack header with visibility controls
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stack Header */}
        <div className="border rounded-lg p-4 bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold">{MOCK_STACK.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{MOCK_STACK.description}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {MOCK_STACK._count.items} items
                </span>
                <span className="flex items-center gap-1">
                  <Bell className="w-4 h-4" />
                  {MOCK_STACK._count.subscribers} subscribers
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {MOCK_STACK._count.comments} comments
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                by {MOCK_STACK.owner.name}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Visibility Selector */}
        <div>
          <p className="text-sm font-medium mb-2">Visibility Mode:</p>
          <div className="grid grid-cols-2 gap-2 bg-white">
            {VISIBILITY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setVisibility(opt.value);
                    toast.success(`Visibility changed to ${opt.label}`);
                  }}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 ${isSelected ? "text-indigo-600" : "text-slate-500"}`} />
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? "text-indigo-700" : ""}`}>{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Collaborators */}
        <div >
          <p className="text-sm font-medium mb-2">Collaborators:</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-amber-50 border-amber-500 p-2 text-amber-700">
              {MOCK_STACK.owner.name} (Owner)
            </Badge>
            {MOCK_STACK.collaborators.map((c) => (
              <Badge key={c.id} variant="outline" className="bg-white  p-2 border-slate-500">
                {c.name} ({c.role})
              </Badge>
            ))}
             </div>
            <Button className="bg-white mt-2">
              <UserPlus className="w-3 h-3 " />
              Add
            </Button>
       
        </div>
      </CardContent>
    </Card>
  );
}

function BlockTypesDemo() {
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Block Types
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 1.2</Badge>
        </CardTitle>
        <CardDescription>
          Support for multiple content types beyond PDFs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* PDF Block */}
          <div className="border bg-white rounded-lg overflow-hidden hover:border-indigo-300 transition-colors">
            <div className="aspect-[4/3] bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
              <FileText className="w-12 h-12 text-red-400" />
            </div>
            <div className="p-3">
              <Badge variant="outline" className="mb-2 text-xs bg-red-50 text-red-700 border-red-200">PDF</Badge>
              <p className="font-medium text-sm truncate">IPCC Climate Report 2025</p>
              <p className="text-xs text-muted-foreground">42 pages • 3.2 MB</p>
            </div>
          </div>
          
          {/* Link Block */}
          <div className="border  bg-white rounded-lg overflow-hidden hover:border-indigo-300 transition-colors">
            <div className="aspect-[4/3] bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <ExternalLink className="w-12 h-12 text-blue-400" />
            </div>
            <div className="p-3">
              <Badge variant="outline" className="mb-2 text-xs bg-blue-50 text-blue-700 border-blue-200">Link</Badge>
              <p className="font-medium text-sm truncate">NASA Climate Portal</p>
              <p className="text-xs text-muted-foreground">climate.nasa.gov</p>
            </div>
          </div>
          
          {/* Text Block */}
          <div className="border bg-white rounded-lg overflow-hidden hover:border-indigo-300 transition-colors">
            <div className="aspect-[4/3] bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center p-3">
              <div className="text-xs text-emerald-600 font-mono line-clamp-4">
                # Research Notes<br/>
                The carbon cycle...<br/>
                - Key finding 1<br/>
                - Key finding 2
              </div>
            </div>
            <div className="p-3">
              <Badge variant="outline" className="mb-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Text</Badge>
              <p className="font-medium text-sm truncate">Research Notes</p>
              <p className="text-xs text-muted-foreground">Markdown • 245 words</p>
            </div>
          </div>
          
          {/* Video Block */}
          <div className="border bg-white rounded-lg overflow-hidden hover:border-indigo-300 transition-colors">
            <div className="aspect-[4/3] bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center relative">
              <VideoIcon className="w-12 h-12 text-purple-400" />
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                1:02:30
              </div>
            </div>
            <div className="p-3">
              <Badge variant="outline" className="mb-2 text-xs bg-purple-50 text-purple-700 border-purple-200">Video</Badge>
              <p className="font-medium text-sm truncate">Climate 101 Documentary</p>
              <p className="text-xs text-muted-foreground">YouTube • 1h 2m</p>
            </div>
          </div>
        </div>
        
        {/* Add Block Button Demo */}
        <div className="mt-4 border-t pt-4">
          <p className="text-sm font-medium mb-2">StackComposer Actions:</p>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-white" onClick={() => toast.info("Opening file picker...")}>
              <FileText className="w-3 h-3 mr-1" />
              Add PDF
            </Button>
             <Button className="bg-white" onClick={() => toast.info("Opening link dialog...")}>
              <LinkIcon className="w-3 h-3 mr-1" />
              Add Link
            </Button>
              <Button className="bg-white" onClick={() => toast.info("Opening note editor...")}>
              <FileTextIcon className="w-3 h-3 mr-1" />
              Add Note
            </Button>
             <Button className="bg-white" onClick={() => toast.info("Opening video dialog...")}>
              <VideoIcon className="w-3 h-3 mr-1" />
              Add Video
            </Button>
            <Button className="bg-white" onClick={() => toast.info("Opening embed picker...")}>
              <FolderIcon className="w-3 h-3 mr-1" />
              Embed Stack
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectionsDemo() {
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Multi-Stack Connections
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 1.1 & 1.3</Badge>
        </CardTitle>
        <CardDescription>
          Blocks can appear in unlimited stacks with context tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Count Badges */}
        <div>
          <p className="text-sm font-medium mb-2">Connection Indicators:</p>
          <div className="flex flex-wrap gap-3">
            {MOCK_BLOCKS.filter(b => b.kind === "block").slice(0, 3).map((block) => (
              <div
                key={block.id}
                onClick={() => setSelectedBlock(block.id)}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedBlock === block.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium truncate max-w-[120px]">{block.title}</span>
                <Badge variant="secondary" className="text-xs">
                  <Link2 className="w-3 h-3 mr-1" />
                  {block.connectedStacksCount}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        
        {/* Contexts Panel Preview */}
        {selectedBlock && (
          <div className="border rounded-lg p-4 bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-indigo-600" />
              <span className="font-medium text-sm">Connections for &ldquo;{MOCK_BLOCKS.find(b => b.id === selectedBlock)?.title}&rdquo;</span>
            </div>
            <div className="space-y-2">
              {["Climate Research Collection", "Policy Papers 2025", "Teaching Resources"].slice(0, MOCK_BLOCKS.find(b => b.id === selectedBlock)?.connectedStacksCount || 1).map((stackName, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div>
                    <p className="text-sm font-medium">{stackName}</p>
                    <p className="text-xs text-muted-foreground">by Dr. Jane Smith • 12 items</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => toast.info("Opening connect modal...")}>
              <PlusCircle className="w-3 h-3 mr-1" />
              Connect to Another Stack
            </Button>
          </div>
        )}
        
        {/* StackItem Benefits */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">StackItem Join Table Benefits:</p>
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              One block can appear in unlimited stacks
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Connection metadata (who added, when, notes)
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              No array rewrite on reorder (position field)
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Concurrency-safe updates
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function StackEmbedsDemo() {
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderIcon className="w-5 h-5" />
          Stack Embeds
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 1.4</Badge>
        </CardTitle>
        <CardDescription>
          Stacks can contain other stacks as embedded items
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Embedded Stack Card Preview */}
        <div className="border-2 border-dashed border-indigo-400  rounded-lg p-4 bg-gradient-to-br from-indigo-50 to-purple-50 hover:border-indigo-700 transition-colors cursor-pointer">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-600">
              <FolderIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Ocean Acidification Studies</h3>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">by Alex Chen • 8 items</p>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                Related research on ocean pH changes and marine ecosystem impacts
              </p>
              <p className="mt-2 text-sm italic text-muted-foreground border-l-2 border-indigo-200 pl-2">
                &ldquo;See this collection for related ocean research&rdquo;
              </p>
            </div>
          </div>
        </div>
        
        {/* Embed Actions */}
        <div className="flex gap-2">
          <Button className="bg-white" onClick={() => toast.info("Opening stack picker...")}>
            <FolderIcon className="w-3 h-3 mr-1" />
            Embed Stack
          </Button>
          <Button className="bg-white" onClick={() => toast.info("Stack embed cards show preview + item count")}>
            Learn More
          </Button>
        </div>
        
        {/* Circular Prevention */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            <strong>⚠️ Circular Prevention:</strong> You cannot embed Stack A into Stack B if Stack B is already embedded in Stack A.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ExportDemo() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: string) => {
    setExporting(format);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success(`Export Ready: ${format.toUpperCase()}`, {
      description: `API endpoint: /api/stacks/{id}/export?format=${format}`,
    });
    setExporting(null);
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Functionality
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 1.6</Badge>
        </CardTitle>
        <CardDescription>
          Export stacks in various formats for portability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {EXPORT_FORMATS.map((format) => {
            const Icon = format.icon;
            const isLoading = exporting === format.format;
            return (
              <button
                key={format.format}
                disabled={isLoading}
                onClick={() => handleExport(format.format)}
                className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <div className="p-3 rounded-full bg-slate-100">
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <span className="font-medium text-sm">{format.label}</span>
                <span className="text-xs text-muted-foreground text-center">{format.description}</span>
              </button>
            );
          })}
        </div>
        
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Fully Implemented:</strong> Export services at{" "}
            <code className="bg-green-100 px-1 rounded">/api/stacks/[id]/export</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 2: EVIDENCE UX (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

function CitationAnchorsDemo() {
  const [selectedCitation, setSelectedCitation] = useState<typeof MOCK_CITATIONS[0] | null>(null);
  
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Highlighter className="w-5 h-5" />
          Citation Anchors
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 2.1</Badge>
        </CardTitle>
        <CardDescription>
          Click citations to jump to exact locations in source documents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Anchor Types */}
        <div>
          <p className="text-sm font-medium mb-3">Anchor Types:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: "page", icon: FileText, label: "Page Anchor", desc: "Jump to specific page in PDF" },
              { type: "annotation", icon: Highlighter, label: "Annotation Anchor", desc: "Navigate to highlighted region" },
              { type: "timestamp", icon: VideoIcon, label: "Timestamp Anchor", desc: "Seek to video time" },
              { type: "text_range", icon: Quote, label: "Text Range", desc: "Select exact text passage" },
            ].map((anchor) => (
              <div
                key={anchor.type}
                className="flex items-start gap-2 p-3 border rounded-lg bg-slate-50"
              >
                <anchor.icon className="w-4 h-4 text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{anchor.label}</p>
                  <p className="text-xs text-muted-foreground">{anchor.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Interactive Citation Cards */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Click a citation to navigate:</p>
          <div className="space-y-2">
            {MOCK_CITATIONS.map((cit) => {
              const intentStyle = CITATION_INTENTS.find(i => i.value === cit.intent);
              return (
                <button
                  key={cit.id}
                  onClick={() => {
                    setSelectedCitation(cit);
                    toast.info(`Navigating to ${cit.source.title}`, {
                      description: cit.anchorType === "page" 
                        ? `Opening PDF at ${cit.locator}`
                        : cit.anchorType === "timestamp"
                        ? `Seeking video to ${cit.locator}`
                        : `Highlighting annotated region`,
                    });
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedCitation?.id === cit.id
                      ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                      : "hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{cit.source.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {cit.anchorType}
                        </Badge>
                        {intentStyle && (
                          <Badge className={`text-xs ${intentStyle.color}`}>
                            {intentStyle.label}
                          </Badge>
                        )}
                      </div>
                      {cit.quote && (
                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                          &ldquo;{cit.quote}&rdquo;
                        </p>
                      )}
                      <p className="text-xs text-indigo-600 mt-1">
                        📍 {cit.locator}
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Navigation Preview */}
        {selectedCitation && (
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
            <p className="text-sm font-medium text-indigo-700 mb-2">Navigation Target:</p>
            <div className="bg-white rounded p-3 shadow-sm">
              <div className="flex items-center gap-2">
                {selectedCitation.source.type === "pdf" ? (
                  <FileText className="w-5 h-5 text-red-500" />
                ) : (
                  <VideoIcon className="w-5 h-5 text-purple-500" />
                )}
                <span className="font-medium">{selectedCitation.source.title}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedCitation.anchorType === "page" && "→ PdfLightbox opens at page 42"}
                {selectedCitation.anchorType === "annotation" && "→ PDF opens with highlight overlay on annotation rect"}
                {selectedCitation.anchorType === "timestamp" && "→ Video player seeks to 00:15:32"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LiftWithCitationsDemo() {
  const [lifting, setLifting] = useState(false);
  const [liftResult, setLiftResult] = useState<{ success: boolean; citationsCopied: number } | null>(null);
  
  const simulateLift = async () => {
    setLifting(true);
    setLiftResult(null);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLiftResult({ success: true, citationsCopied: 3 });
    setLifting(false);
    toast.success("Comment lifted to deliberation!", {
      description: "3 citations were automatically copied to the new claim",
    });
  };
  
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUp className="w-5 h-5" />
          Lift Carries Citations
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 2.2</Badge>
        </CardTitle>
        <CardDescription>
          When comments are lifted to deliberations, citations come along
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment with Citations */}
        <div className="border rounded-lg p-4 bg-slate-50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
              JS
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">Dr. Jane Smith</span>
                <span className="text-xs text-muted-foreground">2 hours ago</span>
              </div>
              <p className="text-sm text-slate-700 mb-3">
                The evidence strongly suggests that immediate policy action is required. 
                The IPCC report clearly states that we&apos;re approaching critical thresholds.
              </p>
              
              {/* Attached Citations */}
              <div className="space-y-1 mb-3">
                <p className="text-xs font-medium text-muted-foreground">Attached Citations:</p>
                {MOCK_CITATIONS.slice(0, 2).map((cit) => (
                  <div key={cit.id} className="flex items-center gap-2 text-xs bg-white p-2 rounded border">
                    <FileText className="w-3 h-3 text-slate-500" />
                    <span>{cit.source.title}</span>
                    <Badge variant="outline" className="text-xs scale-90">{cit.locator}</Badge>
                  </div>
                ))}
              </div>
              
              {/* Lift Button */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={liftResult?.success ? "outline" : "default"}
                  className={liftResult?.success ? "bg-green-50 text-green-700 border-green-300" : ""}
                  disabled={lifting || liftResult?.success}
                  onClick={simulateLift}
                >
                  {lifting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin mr-1" />
                      Lifting...
                    </>
                  ) : liftResult?.success ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Lifted with {liftResult.citationsCopied} citations
                    </>
                  ) : (
                    <>
                      <ArrowUp className="w-3 h-3 mr-1" />
                      Deliberate
                      <span className="ml-1 flex items-center gap-0.5 opacity-70">
                        <FileText className="w-3 h-3" />2
                      </span>
                    </>
                  )}
                </Button>
                {!liftResult?.success && (
                  <span className="text-xs text-muted-foreground">
                    Citations will be copied to the new claim
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Flow Diagram */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Evidence Flow:</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 border rounded-lg text-center">
              <MessageSquare className="w-5 h-5 mx-auto mb-1 text-slate-600" />
              <p className="text-xs font-medium">Stack Comment</p>
              <p className="text-xs text-muted-foreground">with citations</p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-indigo-500" />
            <div className="flex-1 p-3 border rounded-lg text-center border-indigo-300 bg-indigo-50">
              <Quote className="w-5 h-5 mx-auto mb-1 text-indigo-600" />
              <p className="text-xs font-medium text-indigo-700">Deliberation Claim</p>
              <p className="text-xs text-indigo-600">citations preserved</p>
            </div>
          </div>
        </div>
        
        {/* Benefits */}
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Evidence Chain Preserved:</strong> The lift API at{" "}
            <code className="bg-green-100 px-1 rounded">/api/comments/lift</code>{" "}
            automatically copies all attached citations to the new claim, maintaining the evidence trail.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CitationIntentDemo() {
  const [selectedIntent, setSelectedIntent] = useState<string>("supports");
  
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="w-5 h-5" />
          Citation Intent
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 2.3</Badge>
        </CardTitle>
        <CardDescription>
          Semantic meaning for why a source is cited
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Intent Selector */}
        <div>
          <p className="text-sm font-medium mb-3">Select citation intent:</p>
          <div className="flex flex-wrap gap-2">
            {CITATION_INTENTS.map((intent) => (
              <button
                key={intent.value}
                onClick={() => {
                  setSelectedIntent(intent.value);
                  toast.info(`Intent: ${intent.label}`, {
                    description: getIntentDescription(intent.value),
                  });
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedIntent === intent.value
                    ? `${intent.color} ring-2 ring-offset-1`
                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {intent.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Intent Visualization */}
        <div className="border rounded-lg p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Claim:</p>
              <div className="p-3 bg-slate-50 rounded border">
                <p className="text-sm">
                  &ldquo;Immediate climate action is economically beneficial in the long term.&rdquo;
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-8">
              <Badge className={CITATION_INTENTS.find(i => i.value === selectedIntent)?.color}>
                {selectedIntent}
              </Badge>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Source:</p>
              <div className="p-3 bg-slate-50 rounded border">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">Economic Impact Study 2025</span>
                </div>
                <p className="text-xs text-muted-foreground">p. 15-23</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-slate-50 rounded">
            <p className="text-sm text-slate-700">
              <strong className="text-indigo-600">{selectedIntent.charAt(0).toUpperCase() + selectedIntent.slice(1)}:</strong>{" "}
              {getIntentDescription(selectedIntent)}
            </p>
          </div>
        </div>
        
        {/* Intent Usage Stats */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Intent Distribution in Evidence:</p>
          <div className="space-y-2">
            {CITATION_INTENTS.map((intent, i) => {
              const percentage = [45, 25, 15, 10, 5][i];
              return (
                <div key={intent.value} className="flex items-center gap-3">
                  <Badge className={`text-xs w-24 justify-center ${intent.color}`}>
                    {intent.label}
                  </Badge>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-10">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getIntentDescription(intent: string): string {
  switch (intent) {
    case "supports":
      return "This source provides evidence that strengthens or validates the claim.";
    case "refutes":
      return "This source provides counter-evidence or challenges the claim.";
    case "context":
      return "This source provides background information or broader context.";
    case "example":
      return "This source provides a concrete example or case study.";
    case "methodology":
      return "This source describes the methods or approach used.";
    default:
      return "";
  }
}

function DiscussionDemo() {
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Stack Discussions
          <Badge variant="outline" className="ml-2 text-xs">Foundational</Badge>
        </CardTitle>
        <CardDescription>
          FeedPost-based comment threads with citation support
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Thread Preview */}
        <div className="border rounded-lg divide-y">
          {[
            {
              author: "Dr. Jane Smith",
              initials: "JS",
              time: "2 hours ago",
              text: "The methodology section in Chapter 3 raises important questions about sample size.",
              citations: 1,
            },
            {
              author: "Alex Chen",
              initials: "AC",
              time: "1 hour ago",
              text: "I agree. The follow-up study addresses some of these concerns.",
              citations: 2,
              isReply: true,
            },
            {
              author: "Maria Garcia",
              initials: "MG",
              time: "30 min ago",
              text: "Should we lift this to the main deliberation?",
              citations: 0,
              isReply: true,
            },
          ].map((comment, i) => (
            <div key={i} className={`p-3 ${comment.isReply ? "pl-8 bg-slate-50" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-xs">
                  {comment.initials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm">{comment.author}</span>
                    <span className="text-xs text-muted-foreground">{comment.time}</span>
                  </div>
                  <p className="text-sm text-slate-700">{comment.text}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {comment.citations > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <FileText className="w-3 h-3 mr-1" />
                        {comment.citations} citation{comment.citations > 1 ? "s" : ""}
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                      Reply
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                      <ArrowUp className="w-3 h-3 mr-1" />
                      Deliberate
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Composer Preview */}
        <div className="border rounded-lg p-3 bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium">Add to discussion</span>
          </div>
          <div className="bg-white border rounded p-2 text-sm text-muted-foreground">
            Write your comment... (supports markdown, citations, @mentions)
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button variant="outline" size="sm" className="text-xs">
              <Quote className="w-3 h-3 mr-1" />
              Add Citation
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              Cite from Stack
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DragDropDemo() {
  const [items, setItems] = useState(["IPCC Report 2025", "NASA Climate Portal", "Research Notes"]);
  
  const moveItem = (from: number, to: number) => {
    const newItems = [...items];
    const [removed] = newItems.splice(from, 1);
    newItems.splice(to, 0, removed);
    setItems(newItems);
    toast.info("Order updated", { description: "Changes saved automatically" });
  };
  
  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GripVertical className="w-5 h-5" />
          Drag-and-Drop Ordering
          <Badge variant="outline" className="ml-2 text-xs">Foundational</Badge>
        </CardTitle>
        <CardDescription>
          Reorder documents within stacks visually (using @dnd-kit)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-3 p-3 border rounded-lg bg-white hover:border-indigo-300 transition-colors"
            >
              <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
              <span className="flex-1 text-sm font-medium">{item}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={i === 0}
                  onClick={() => moveItem(i, i - 1)}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={i === items.length - 1}
                  onClick={() => moveItem(i, i + 1)}
                >
                  ↓
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>⚡ Optimistic Updates:</strong> Drag operations update locally first, 
            then sync with server via <code className="bg-blue-100 px-1 rounded">setStackOrder</code> action.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS - PART 3: SOURCE TRUST & INTELLIGENCE (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

function SourceVerificationDemo() {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [verifying, setVerifying] = useState<string | null>(null);

  const handleVerify = async (alertId: string, title: string) => {
    setVerifying(alertId);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setVerifying(null);
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    toast.success(`Source Re-verified`, {
      description: `${title} has been checked and updated`,
    });
  };

  const handleDismiss = (alertId: string, title: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    toast.info(`Alert Dismissed`, {
      description: `${title} alert hidden from view`,
    });
  };

  const activeAlerts = MOCK_SOURCE_ALERTS.filter(a => !dismissedAlerts.has(a.id));

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Source Freshness & Verification
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.1</Badge>
        </CardTitle>
        <CardDescription>
          Monitor source health with automated verification checks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Verification Status Indicators */}
        <div>
          <p className="text-sm font-medium mb-3">Verification Statuses:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { status: "verified", color: "bg-green-100 text-green-700 border-green-300", icon: Check, label: "Verified" },
              { status: "unverified", color: "bg-gray-100 text-gray-700 border-gray-300", icon: Eye, label: "Unverified" },
              { status: "broken", color: "bg-red-100 text-red-700 border-red-300", icon: AlertTriangle, label: "Broken Link" },
              { status: "archived", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Archive, label: "Archived" },
            ].map((item) => (
              <div
                key={item.status}
                className={`flex items-center gap-2 p-3 border rounded-lg ${item.color}`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Source Alerts */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Active Source Alerts:</p>
            {dismissedAlerts.size > 0 && (
              <button
                onClick={() => {
                  setDismissedAlerts(new Set());
                  toast.info("All alerts restored");
                }}
                className="text-xs text-indigo-600 hover:underline"
              >
                Reset ({dismissedAlerts.size} dismissed)
              </button>
            )}
          </div>
          {activeAlerts.length === 0 ? (
            <div className="p-4 text-center border rounded-lg bg-green-50 border-green-200">
              <Check className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-sm font-medium text-green-700">All Clear</p>
              <p className="text-xs text-green-600">No active source alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert) => {
                const severityStyles = {
                  critical: "bg-red-50 border-red-200 text-red-700",
                  warning: "bg-amber-50 border-amber-200 text-amber-700",
                  info: "bg-blue-50 border-blue-200 text-blue-700",
                };
                const isVerifying = verifying === alert.id;
                return (
                  <div
                    key={alert.id}
                    className={`p-3 border rounded-lg ${severityStyles[alert.severity as keyof typeof severityStyles]}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{alert.sourceTitle}</p>
                        <p className="text-xs mt-0.5">{alert.message}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {alert.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        disabled={isVerifying}
                        onClick={() => handleVerify(alert.id, alert.sourceTitle)}
                      >
                        {isVerifying ? (
                          <>
                            <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin mr-1" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            Re-verify
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => handleDismiss(alert.id, alert.sourceTitle)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Worker at{" "}
            <code className="bg-green-100 px-1 rounded">workers/sourceVerification.ts</code>{" "}
            checks sources via BullMQ queue
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReferenceManagerDemo() {
  const [importing, setImporting] = useState(false);
  
  const handleImport = async (source: string) => {
    setImporting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success(`Import Complete`, {
      description: `Imported 12 references from ${source}`,
    });
    setImporting(false);
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LibraryBig className="w-5 h-5" />
          Reference Manager Integration
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.2</Badge>
        </CardTitle>
        <CardDescription>
          Import sources from Zotero, Mendeley, BibTeX, and more
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: "zotero", name: "Zotero", desc: "Connect your Zotero library" },
            { id: "mendeley", name: "Mendeley", desc: "Import from Mendeley" },
            { id: "bibtex", name: "BibTeX", desc: "Upload .bib files" },
            { id: "ris", name: "RIS", desc: "Import RIS format" },
          ].map((source) => (
            <button
              key={source.id}
              disabled={importing}
              onClick={() => handleImport(source.name)}
              className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <BookOpen className="w-6 h-6 text-indigo-600" />
              <span className="font-medium text-sm">{source.name}</span>
              <span className="text-xs text-muted-foreground text-center">{source.desc}</span>
            </button>
          ))}
        </div>
        
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> API at{" "}
            <code className="bg-green-100 px-1 rounded">/api/reference-manager/import</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CrossPlatformIntelligenceDemo() {
  const SOURCES_DATA = [
    {
      id: "s1",
      title: "IPCC Climate Report 2025",
      doi: "doi:10.1000/ipcc-2025",
      trust: "High",
      trustColor: "bg-green-50 text-green-700",
      stats: { deliberations: 12, citations: 45, stacks: 8 },
      contexts: [
        { delib: "Carbon Capture Debate", quote: "confirms 1.5°C threshold...", intent: "supports" },
        { delib: "Policy Analysis", quote: "methodology limitations...", intent: "context" },
      ],
    },
    {
      id: "s2",
      title: "Ocean Acidification Study",
      doi: "doi:10.1000/ocean-ph",
      trust: "Medium",
      trustColor: "bg-amber-50 text-amber-700",
      stats: { deliberations: 5, citations: 18, stacks: 3 },
      contexts: [
        { delib: "Marine Conservation", quote: "pH levels declining at 0.02/decade...", intent: "supports" },
        { delib: "Fisheries Impact", quote: "economic projections uncertain...", intent: "refutes" },
      ],
    },
    {
      id: "s3",
      title: "Renewable Energy Economics",
      doi: "doi:10.1000/re-econ",
      trust: "High",
      trustColor: "bg-green-50 text-green-700",
      stats: { deliberations: 9, citations: 32, stacks: 6 },
      contexts: [
        { delib: "Energy Transition", quote: "cost parity achieved by 2024...", intent: "supports" },
      ],
    },
  ];

  const [selectedSource, setSelectedSource] = useState(SOURCES_DATA[0]);

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="w-5 h-5" />
          Cross-Platform Intelligence
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.3</Badge>
        </CardTitle>
        <CardDescription>
          Track how sources are used across deliberations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source Selector */}
        <div>
          <p className="text-sm font-medium mb-2">Select a source:</p>
          <div className="flex gap-2">
            {SOURCES_DATA.map((src) => (
              <button
                key={src.id}
                onClick={() => {
                  setSelectedSource(src);
                  toast.info(src.title, {
                    description: `${src.stats.citations} citations across ${src.stats.deliberations} deliberations`,
                  });
                }}
                className={`flex-1 p-2 text-left border rounded-lg text-xs transition-all ${
                  selectedSource.id === src.id
                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                    : "hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <p className="font-medium truncate">{src.title}</p>
                <p className="text-muted-foreground mt-0.5">{src.stats.citations} citations</p>
              </button>
            ))}
          </div>
        </div>

        {/* Usage Stats */}
        <div className="border rounded-lg p-4 bg-slate-50">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-medium">{selectedSource.title}</p>
              <p className="text-xs text-muted-foreground">{selectedSource.doi}</p>
            </div>
            <Badge variant="outline" className={selectedSource.trustColor}>{selectedSource.trust} Trust</Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-indigo-600">{selectedSource.stats.deliberations}</p>
              <p className="text-xs text-muted-foreground">Deliberations</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{selectedSource.stats.citations}</p>
              <p className="text-xs text-muted-foreground">Citations</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{selectedSource.stats.stacks}</p>
              <p className="text-xs text-muted-foreground">Stacks</p>
            </div>
          </div>
        </div>
        
        {/* Citation Contexts */}
        <div>
          <p className="text-sm font-medium mb-2">Recent Citation Contexts:</p>
          <div className="space-y-2">
            {selectedSource.contexts.map((ctx, i) => (
              <div key={i} className="p-2 border rounded bg-white text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">{ctx.intent}</Badge>
                  <span className="text-muted-foreground text-xs">{ctx.delib}</span>
                </div>
                <p className="text-xs italic">&ldquo;{ctx.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Models{" "}
            <code className="bg-green-100 px-1 rounded">SourceUsage</code>,{" "}
            <code className="bg-green-100 px-1 rounded">SourceCitationContext</code>,{" "}
            <code className="bg-green-100 px-1 rounded">EvidenceProvenanceEvent</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function KnowledgeGraphDemo() {
  const GRAPH_NODES = [
    { id: "S1", label: "IPCC Report", type: "source", x: 15, y: 20, color: "#3b82f6" },
    { id: "T1", label: "Climate Change", type: "topic", x: 40, y: 35, color: "#10b981" },
    { id: "D1", label: "Carbon Policy", type: "deliberation", x: 70, y: 15, color: "#8b5cf6" },
    { id: "S2", label: "NASA Portal", type: "source", x: 25, y: 65, color: "#3b82f6" },
    { id: "A1", label: "Dr. Smith", type: "author", x: 65, y: 70, color: "#f59e0b" },
    { id: "T2", label: "Ocean Science", type: "topic", x: 50, y: 55, color: "#10b981" },
  ];

  const GRAPH_EDGES = [
    { from: "S1", to: "T1", label: "about" },
    { from: "T1", to: "D1", label: "discussed in" },
    { from: "S2", to: "T1", label: "about" },
    { from: "S2", to: "T2", label: "about" },
    { from: "A1", to: "S1", label: "authored" },
    { from: "A1", to: "D1", label: "participates" },
  ];

  const [selectedNode, setSelectedNode] = useState<typeof GRAPH_NODES[0] | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const connectedEdges = selectedNode
    ? GRAPH_EDGES.filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
    : [];
  const connectedNodeIds = new Set(
    connectedEdges.flatMap(e => [e.from, e.to])
  );

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Knowledge Graph View
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.4.1</Badge>
        </CardTitle>
        <CardDescription>
          Explore connections between sources, topics, and deliberations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Interactive Graph Visualization */}
        <div className="border rounded-lg p-4 bg-slate-900 text-white min-h-[220px] relative overflow-hidden">
          {/* Edges (SVG lines) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            {GRAPH_EDGES.map((edge, i) => {
              const fromNode = GRAPH_NODES.find(n => n.id === edge.from)!;
              const toNode = GRAPH_NODES.find(n => n.id === edge.to)!;
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
                        const edges = GRAPH_EDGES.filter(e => e.from === next.id || e.to === next.id);
                        toast.info(`${next.label}`, {
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
                        isSelected ? "ring-2 ring-white scale-125 border-white" : isHovered ? "scale-110 border-white/60" : "border-transparent"
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
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500" /> Sources</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> Topics</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500" /> Deliberations</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500" /> Authors</span>
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
                const otherNode = GRAPH_NODES.find(n => n.id === otherNodeId)!;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: otherNode.color }}
                    />
                    <span className="text-slate-500">{edge.label}</span>
                    <span className="font-medium">{otherNode.label}</span>
                    <Badge variant="outline" className="text-[10px] scale-90">{otherNode.type}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 border rounded">
            <p className="font-medium">Node Types</p>
            <p className="text-xs text-muted-foreground">Sources, Topics, Deliberations, Authors</p>
          </div>
          <div className="p-2 border rounded">
            <p className="font-medium">Edge Types</p>
            <p className="text-xs text-muted-foreground">Citations, Topic Links, Authorship</p>
          </div>
        </div>
        
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> D3 visualization at{" "}
            <code className="bg-green-100 px-1 rounded">components/explore/KnowledgeGraphExplorer.tsx</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RelatedContentDemo() {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());

  const handleBookmark = (id: string, title: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info("Removed from bookmarks", { description: title });
      } else {
        next.add(id);
        toast.success("Bookmarked for later", { description: title });
      }
      return next;
    });
  };

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="w-5 h-5" />
          Related Content Discovery
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.4.2</Badge>
        </CardTitle>
        <CardDescription>
          Find deliberations, stacks, and sources with shared evidence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {MOCK_RELATED_ITEMS.map((item) => {
            const isSelected = selectedItem === item.id;
            const isBookmarked = bookmarked.has(item.id);
            return (
              <div key={item.id}>
                <button
                  className={`w-full flex items-center justify-between p-3 border rounded-lg transition-all text-left ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                      : "hover:bg-slate-50 hover:border-slate-300"
                  }`}
                  onClick={() => {
                    setSelectedItem(isSelected ? null : item.id);
                    if (!isSelected) {
                      toast.info(`Viewing: ${item.title}`, {
                        description: `${item.score}% relevance • ${item.reason}`,
                      });
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {item.type === "deliberation" ? (
                      <MessageSquare className="w-5 h-5 text-purple-500" />
                    ) : (
                      <Layers className="w-5 h-5 text-blue-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8">{item.score}%</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                  </div>
                </button>
                {isSelected && (
                  <div className="mt-1 ml-8 p-3 bg-slate-50 border rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Shared evidence basis with your current deliberation
                      </span>
                      <Button
                        variant={isBookmarked ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookmark(item.id, item.title);
                        }}
                      >
                        {isBookmarked ? (
                          <><Check className="w-3 h-3 mr-1" /> Saved</>
                        ) : (
                          <><PlusCircle className="w-3 h-3 mr-1" /> Save</>
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {item.score >= 80 ? "Strong match" : item.score >= 60 ? "Good match" : "Partial match"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Components at{" "}
            <code className="bg-green-100 px-1 rounded">components/related/</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/deliberations/[id]/related</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineViewDemo() {
  const ALL_EVENTS = [
    ...MOCK_TIMELINE_EVENTS,
    { id: "tl-extra-1", title: "Follow-up Study Published", year: 2021, color: "#3b82f6", type: "Published" },
    { id: "tl-extra-2", title: "Methodology Critique", year: 2023, color: "#8b5cf6", type: "Argument" },
    { id: "tl-extra-3", title: "Data Replication Confirmed", year: 2024, color: "#10b981", type: "Cited" },
  ];

  const [selectedEvent, setSelectedEvent] = useState<typeof ALL_EVENTS[0] | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [yearRange, setYearRange] = useState<[number, number]>([2020, 2025]);

  const filteredEvents = ALL_EVENTS.filter(evt => {
    if (filterType && evt.type !== filterType) return false;
    if (evt.year < yearRange[0] || evt.year > yearRange[1]) return false;
    return true;
  });

  const EVENT_TYPES = [
    { type: "Published", color: "#3b82f6" },
    { type: "Cited", color: "#10b981" },
    { type: "Argument", color: "#8b5cf6" },
    { type: "Retraction", color: "#ef4444" },
  ];

  return (
    <Card className="bg-indigo-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Timeline View
          <Badge className="ml-2 bg-indigo-600 text-xs">Phase 3.4.3</Badge>
        </CardTitle>
        <CardDescription>
          Temporal visualization of evidence evolution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Filter:</span>
            <button
              onClick={() => setFilterType(null)}
              className={`px-2 py-1 rounded text-xs border transition-colors ${
                filterType === null ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "hover:bg-slate-50"
              }`}
            >
              All
            </button>
            {EVENT_TYPES.map((et) => (
              <button
                key={et.type}
                onClick={() => {
                  setFilterType(filterType === et.type ? null : et.type);
                  toast.info(`Filtering: ${filterType === et.type ? "All events" : et.type}`);
                }}
                className={`px-2 py-1 rounded text-xs border transition-colors flex items-center gap-1 ${
                  filterType === et.type ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "hover:bg-slate-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: et.color }} />
                {et.type}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-muted-foreground">Zoom:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0 text-xs"
              onClick={() => {
                setYearRange(([s, e]) => [Math.min(s + 1, e - 1), e]);
              }}
              disabled={yearRange[1] - yearRange[0] <= 1}
            >
              −
            </Button>
            <span className="text-xs font-mono w-16 text-center">{yearRange[0]}–{yearRange[1]}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 w-6 p-0 text-xs"
              onClick={() => {
                setYearRange(([s, e]) => [Math.max(s - 1, 2018), Math.min(e + 1, 2026)]);
              }}
              disabled={yearRange[0] <= 2018 && yearRange[1] >= 2026}
            >
              +
            </Button>
          </div>
        </div>

        {/* Mini Timeline */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            {Array.from({ length: yearRange[1] - yearRange[0] + 1 }, (_, i) => yearRange[0] + i).map((year) => (
              <span key={year}>{year}</span>
            ))}
          </div>
          <div className="relative h-2 bg-gray-200 rounded-full">
            {filteredEvents.map((evt) => {
              const range = yearRange[1] - yearRange[0];
              const pos = ((evt.year - yearRange[0]) / range) * 100;
              if (pos < 0 || pos > 100) return null;
              const isSelected = selectedEvent?.id === evt.id;
              return (
                <Tooltip key={evt.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={`absolute rounded-full border-2 border-white shadow cursor-pointer transform -translate-y-0.5 transition-all ${
                        isSelected ? "w-4 h-4 ring-2 ring-indigo-400 -translate-y-1 z-10" : "w-3 h-3"
                      }`}
                      style={{
                        left: `${pos}%`,
                        backgroundColor: evt.color,
                      }}
                      onClick={() => {
                        const next = isSelected ? null : evt;
                        setSelectedEvent(next);
                        if (next) {
                          toast.info(next.title, { description: `${next.year} • ${next.type}` });
                        }
                      }}
                      aria-label={`${evt.title} (${evt.year})`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-medium">{evt.title}</p>
                    <p className="text-xs text-muted-foreground">{evt.year} • {evt.type}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""} shown
            {filterType && ` (${filterType} only)`}
          </p>
        </div>

        {/* Selected Event Detail */}
        {selectedEvent && (
          <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedEvent.color }} />
              <p className="text-sm font-medium text-indigo-700">{selectedEvent.title}</p>
            </div>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{selectedEvent.year}</Badge>
              <Badge variant="outline" className="text-xs">{selectedEvent.type}</Badge>
            </div>
          </div>
        )}
        
        {/* Event Types Legend */}
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((item) => (
            <div key={item.type} className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.type}
            </div>
          ))}
        </div>
        
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            <strong>✅ Implemented:</strong> Component at{" "}
            <code className="bg-green-100 px-1 rounded">components/timeline/TimelineView.tsx</code> •
            API at <code className="bg-green-100 px-1 rounded">/api/timeline</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function StacksFeaturesPage() {
  return (
    <TooltipProvider>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Header */}
        <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Stacks Features Demo</h1>
                  <p className="text-sm text-muted-foreground">
                    Foundational + Phase 1-3 Improvements
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
          {/* Introduction */}
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-white shadow-sm">
                  <Layers className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-indigo-900">Stacks/Library System</h2>
                  <p className="text-indigo-700 mt-1">
                    Document management and knowledge organization infrastructure with deep deliberation integration.
                    Curate collections of PDFs, links, notes, and videos. Connect blocks across multiple stacks.
                    Cite sources with executable references. Export for portability.
                  </p>
                  <div className="flex gap-4 mt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">21+</p>
                      <p className="text-xs text-indigo-600">Features</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">4</p>
                      <p className="text-xs text-indigo-600">Phases</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">6</p>
                      <p className="text-xs text-indigo-600">Block Types</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="flex w-full justify-start p-1 h-auto ">
              <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
              <TabsTrigger value="blocks" className="text-sm">Block Types</TabsTrigger>
              <TabsTrigger value="connections" className="text-sm">Connections</TabsTrigger>
              <TabsTrigger value="evidence" className="text-sm">Evidence UX</TabsTrigger>
              <TabsTrigger value="exports" className="text-sm">Exports</TabsTrigger>
              <TabsTrigger value="verification" className="text-sm">Source Trust</TabsTrigger>
              <TabsTrigger value="discovery" className="text-sm">Discovery</TabsTrigger>
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
            
            {/* Block Types Tab */}
            <TabsContent value="blocks" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Block Types & Content</h3>
                <p className="text-sm text-muted-foreground">Stacks support multiple content types — PDFs, links, text notes, videos, and nested stack embeds.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BlockTypesDemo />
                <StackEmbedsDemo />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StackPreviewCard />
                <DragDropDemo />
              </div>
            </TabsContent>
            
            {/* Connections Tab */}
            <TabsContent value="connections" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Multi-Stack Connections</h3>
                <p className="text-sm text-muted-foreground">Blocks can belong to multiple stacks simultaneously, enabling cross-collection discovery and re-use.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ConnectionsDemo />
                <StackEmbedsDemo />
              </div>
            </TabsContent>
            
            {/* Evidence UX Tab */}
            <TabsContent value="evidence" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Evidence UX <Badge variant="outline" className="ml-2">Phase 2</Badge></h3>
                <p className="text-sm text-muted-foreground">Executable citations, semantic intent labeling, and evidence-preserving lift workflows.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CitationAnchorsDemo />
                <LiftWithCitationsDemo />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CitationIntentDemo />
                <DiscussionDemo />
              </div>
            </TabsContent>
            
            {/* Exports Tab */}
            <TabsContent value="exports" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Export & Portability <Badge variant="outline" className="ml-2">Phase 1.6</Badge></h3>
                <p className="text-sm text-muted-foreground">Export stacks as JSON, Markdown, or BibTeX for academic citations and cross-platform portability.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ExportDemo />
                <Card className="bg-indigo-50/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Implementation Reference
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="font-semibold text-indigo-600 mb-2">Core Stack Components</p>
                        <ul className="space-y-1 font-mono text-xs text-slate-600">
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/SortablePdfGrid.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/StackComposer.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/StackDiscussion.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/LiftToDebateButton.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/CommentComposer.tsx</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-indigo-600 mb-2">Phase 1 Components</p>
                        <ul className="space-y-1 font-mono text-xs text-slate-600">
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/ConnectButton.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/ContextsPanel.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/VisibilitySelector.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/ExportButton.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/stack/blocks/StackEmbedCard.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/blocks/LinkBlockCard.tsx</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> components/blocks/TextBlockCard.tsx</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-indigo-600 mb-2">API Routes</p>
                        <ul className="space-y-1 font-mono text-xs text-slate-600">
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/stacks/[id]/export</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/blocks/[id]/contexts</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/library/upload</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/comments/lift</li>
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> /api/citations/resolve</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-indigo-600 mb-2">Server Actions</p>
                        <ul className="space-y-1 font-mono text-xs text-slate-600">
                          <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> lib/actions/stack.actions.ts</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Full Implementation Reference Card */}
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
                      <p className="font-semibold mb-2 text-indigo-300">Data Models</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Stack</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> StackItem (join table)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> LibraryPost</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> StackCollaborator</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> StackSubscription</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Source</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Citation</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Annotation</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">Citation Infrastructure</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/citations/navigation.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/citations/anchorTypes.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/citations/CitationCard.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/citations/PdfNavigationListener.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/modals/PdfLightbox.tsx</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">Architecture Docs</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> STACKS_LIBRARY_SYSTEM_ARCHITECTURE.md</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> STACKS_IMPROVEMENT_PHASE_1.md</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> STACKS_IMPROVEMENT_PHASE_2.md</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> STACKS_IMPROVEMENT_PHASE_3.md</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-300">Key Integration Points:</strong>{" "}
                      Stacks host deliberations via <code className="bg-slate-700 px-1 rounded">library_stack</code> host type •
                      Citations flow from stacks to arguments via Source model •
                      Evidence aggregation tracks source usage across deliberations
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Source Trust Tab (Phase 3.1-3.3) */}
            <TabsContent value="verification" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Source Trust & Intelligence <Badge variant="outline" className="ml-2">Phase 3.1–3.3</Badge></h3>
                <p className="text-sm text-muted-foreground">Automated source verification, reference manager integration, and cross-platform usage intelligence.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SourceVerificationDemo />
                <ReferenceManagerDemo />
              </div>
              <div className="grid grid-cols-1 gap-6">
                <CrossPlatformIntelligenceDemo />
              </div>
              
              {/* Phase 3 Implementation Reference */}
              <Card className="bg-slate-800 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Phase 3 Implementation Reference
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">New Data Models</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> SourceAlert</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> ReferenceManagerItem</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> SourceUsage</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> SourceCitationContext</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> EvidenceProvenanceEvent</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> ExplorerNode</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> ExplorerEdge</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">Workers & Libraries</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> workers/sourceVerification.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> workers/knowledgeGraphBuilder.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/similarity/computeSimilarity.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/timeline/buildTimeline.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/knowledgeGraph/queryGraph.ts</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">API Endpoints</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/sources/[id]/verify</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/reference-manager/import</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/knowledge-graph</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/timeline</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/deliberations/[id]/related</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Discovery Tab (Phase 3.4) */}
            <TabsContent value="discovery" className="space-y-6">
              <div className="rounded-lg border bg-slate-50 p-4">
                <h3 className="font-semibold text-lg">Discovery & Exploration <Badge variant="outline" className="ml-2">Phase 3.4</Badge></h3>
                <p className="text-sm text-muted-foreground">Knowledge graph visualization, related content recommendations, and temporal evidence timelines.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <KnowledgeGraphDemo />
                <RelatedContentDemo />
              </div>
              <div className="grid grid-cols-1 gap-6">
                <TimelineViewDemo />
              </div>
              
              {/* Explore Page Link */}
              <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-white shadow-sm">
                        <Sparkles className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-purple-900">Try the Explore Page</h3>
                        <p className="text-sm text-purple-700">
                          Interactive knowledge graph visualization with D3.js force-directed layout
                        </p>
                      </div>
                    </div>
                    <Button asChild className="bg-purple-600 hover:bg-purple-700">
                      <a href="/explore">
                        Open Explore <ExternalLink className="w-4 h-4 ml-2" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* Phase 3.4 Discovery Implementation Reference */}
              <Card className="bg-slate-800 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Phase 3.4 Discovery Implementation Reference
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">Components</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> KnowledgeGraphExplorer.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> RelatedDeliberations.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> RelatedStacks.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> RelatedSources.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> TimelineView.tsx</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">Libraries</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/similarity/computeSimilarity.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/timeline/types.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/timeline/buildTimeline.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/knowledgeGraph/queryGraph.ts</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-indigo-300">API Endpoints</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/knowledge-graph</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/deliberations/[id]/related</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> /api/timeline</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-300">Architecture:</strong>{" "}
                      Knowledge graph built by <code className="bg-slate-700 px-1 rounded">workers/knowledgeGraphBuilder.ts</code> •
                      Similarity computed via Jaccard coefficient on shared sources •
                      Timeline events aggregate publication dates, citation events, and retractions
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Footer */}
          <div className="text-center text-sm text-slate-500 pb-8">
            <p>Stacks Features Demo • Foundational + Phase 1-3 Complete • Mesh Platform</p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
