"use client";

/**
 * Article Features Demo Page
 *
 * Interactive demonstration of all article system features:
 *
 * FOUNDATIONAL FEATURES:
 * - Article Creation & Templates (Standard, Feature, Interview)
 * - TipTap Rich Text Editor (slash commands, toolbar, custom nodes)
 * - Hero Image & Media (upload, crop, alt text)
 * - Autosave & Revision History
 * - Articles Dashboard (CRUD, search, filter, trash/restore)
 *
 * PHASE 1 – EDITOR POWER:
 * - 1.1 Custom Nodes (PullQuote, Callout, MathBlock, MathInline)
 * - 1.2 Slash Commands (Image, Quote, Callout, Latex)
 * - 1.3 Advanced Toolbar (fonts, sizes, colors, weights, alignment, transforms)
 * - 1.4 Character Counting & Limits (20k)
 * - 1.5 Paste Sanitization (DOMPurify + HTML normalization)
 * - 1.6 Section Breaks, Indent, Code Blocks, Quick Links
 *
 * PHASE 2 – PUBLISHING & READING:
 * - 2.1 Publish Workflow (draft → published, slug, excerpt, reading time)
 * - 2.2 Template-based Reader (Standard, Feature, Interview layouts)
 * - 2.3 Article Cards & Preview Modals
 * - 2.4 Social Actions (Like, Save, Share)
 * - 2.5 Feed Integration (published articles create feed posts)
 *
 * PHASE 3 – ANNOTATION & DELIBERATION:
 * - 3.1 Text Selection → Anchored Comment Threads
 * - 3.2 Comment Rail with Collision Resolution
 * - 3.3 Rhetoric Analysis Overlays (hedge, intensifier, absolute, analogy, metaphor)
 * - 3.4 Deliberation Panel Integration (deliberation, arguments, claims)
 * - 3.5 Proposition Composer (lift annotations to deliberation)
 *
 * Accessible at: /test/article-features
 */

import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  FileText,
  Pencil,
  Eye,
  BookOpen,
  Image as ImageIcon,
  Save,
  History,
  LayoutTemplate,
  Search,
  Trash2,
  RotateCcw,
  Filter,
  Type,
  Code,
  Quote,
  AlertCircle,
  Sigma,
  Slash,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  ListChecks,
  Palette,
  CaseSensitive,
  ArrowUpDown,
  Highlighter,
  Link2,
  Eraser,
  ShieldCheck,
  Clock,
  Hash,
  Newspaper,
  Heart,
  Bookmark,
  Share2,
  ExternalLink,
  MessageSquare,
  MessageCircle,
  Crosshair,
  Layers,
  PanelRightOpen,
  Sparkles,
  GitBranch,
  BarChart3,
  Scale,
  Lightbulb,
  Check,
  ChevronRight,
  PlusCircle,
  Settings,
  Maximize2,
  SeparatorHorizontal,
  Indent,
  TabletSmartphone,
  Scissors,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ARTICLES = {
  attention: {
    id: "article-demo-1",
    title: "The Hidden Cost of Attention: How Algorithmic Feeds Reshape Civic Discourse",
    slug: "the-hidden-cost-of-attention-how-algorithmic-feeds-reshape-civic-discourse",
    template: "feature" as const,
    status: "PUBLISHED" as const,
    heroImageKey: "hero-demo-1.jpg",
    excerpt: "A deep investigation into how engagement-optimized recommendation systems systematically deprioritize nuance, amplify outrage, and erode the epistemic commons we depend on for democratic self-governance.",
    readingTime: 14,
    publishedAt: "2026-03-15T10:00:00Z",
    createdAt: "2026-03-01T08:00:00Z",
    updatedAt: "2026-03-15T10:00:00Z",
    allowAnnotations: true,
    author: { id: "user-1", name: "Dr. Priya Anand", username: "panand" },
  },
  socialChoice: {
    id: "article-demo-2",
    title: "Arrow's Impossibility Theorem and the Limits of Preference Aggregation",
    slug: "arrows-impossibility-theorem-limits-preference-aggregation",
    template: "standard" as const,
    status: "PUBLISHED" as const,
    heroImageKey: null,
    excerpt: "A formal treatment of Arrow's impossibility result, extending it to deliberative contexts where preference transformation — not just aggregation — is the mechanism of collective choice.",
    readingTime: 18,
    publishedAt: "2026-02-20T08:00:00Z",
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-02-20T08:00:00Z",
    allowAnnotations: true,
    author: { id: "user-2", name: "Prof. Marcus Chen", username: "mchen" },
  },
};

type ArticleKey = keyof typeof MOCK_ARTICLES;

const MOCK_ARTICLES_LIST = [
  {
    id: "article-1",
    title: "The Hidden Cost of Attention: How Algorithmic Feeds Reshape Civic Discourse",
    slug: "the-hidden-cost-of-attention-how-algorithmic-feeds-reshape-civic-discourse",
    template: "feature",
    status: "PUBLISHED" as const,
    readingTime: 14,
    excerpt: "How engagement-optimized recommendation systems deprioritize nuance, amplify outrage, and erode the epistemic commons...",
    updatedAt: "2026-03-15T10:00:00Z",
    heroImageKey: "hero-1.jpg",
  },
  {
    id: "article-2",
    title: "Interview: Danielle Allen on Participatory Technology and Power",
    slug: null,
    template: "interview",
    status: "DRAFT" as const,
    readingTime: null,
    excerpt: null,
    updatedAt: "2026-03-20T14:30:00Z",
    heroImageKey: null,
  },
  {
    id: "article-3",
    title: "Why Prediction Markets Get Elections Wrong",
    slug: "why-prediction-markets-get-elections-wrong",
    template: "standard",
    status: "PUBLISHED" as const,
    readingTime: 9,
    excerpt: "Thin markets, correlated information sources, and motivated reasoning create systematic blind spots in political prediction...",
    updatedAt: "2026-02-28T09:00:00Z",
    heroImageKey: "hero-3.jpg",
  },
  {
    id: "article-4",
    title: "Climate Conversations: A Comparative Study of Citizen Deliberations in FR and US",
    slug: null,
    template: "standard",
    status: "DRAFT" as const,
    readingTime: null,
    excerpt: null,
    updatedAt: "2026-03-22T16:45:00Z",
    heroImageKey: null,
  },
  {
    id: "article-5",
    title: "Arrow's Impossibility Theorem and the Limits of Preference Aggregation",
    slug: "arrows-impossibility-theorem-limits-preference-aggregation",
    template: "standard",
    status: "PUBLISHED" as const,
    readingTime: 18,
    excerpt: "A formal treatment of Arrow's impossibility result, extending it to deliberative contexts...",
    updatedAt: "2026-02-20T08:00:00Z",
    heroImageKey: null,
  },
];

const MOCK_REVISIONS = [
  { id: "rev-5", createdAt: "2026-03-15T10:00:00Z", label: "Published version" },
  { id: "rev-4", createdAt: "2026-03-14T18:30:00Z", label: "Incorporated peer review feedback" },
  { id: "rev-3", createdAt: "2026-03-12T11:00:00Z", label: "Added empirical evidence section" },
  { id: "rev-2", createdAt: "2026-03-05T09:15:00Z", label: "Restructured around three attention mechanisms" },
  { id: "rev-1", createdAt: "2026-03-01T08:00:00Z", label: "Initial draft" },
];

interface MockThread {
  id: string;
  anchor: { startPath: string; startOffset: number; endPath: string; endOffset: number };
  anchorText: string;
  resolved: boolean;
  comments: { id: string; authorName: string; body: string; createdAt: string }[];
}

const MOCK_THREADS: MockThread[] = [
  {
    id: "thread-1",
    anchor: { startPath: "0/0", startOffset: 4, endPath: "0/0", endOffset: 42 },
    anchorText: "engagement-maximizing recommender systems",
    resolved: false,
    comments: [
      { id: "c-1a", authorName: "Prof. James Williams", body: "This framing aligns with my research on attentional scarcity — but I'd push back on treating all engagement optimization as equivalent. Some designs surface serendipity rather than outrage.", createdAt: "2026-03-16T09:00:00Z" },
      { id: "c-1b", authorName: "Dr. Priya Anand", body: "Fair distinction. I'll add a taxonomy in §3 separating curiosity-driven engagement from reactive engagement. The harm concentrates in the latter.", createdAt: "2026-03-16T10:30:00Z" },
    ],
  },
  {
    id: "thread-2",
    anchor: { startPath: "2/0", startOffset: 0, endPath: "2/0", endOffset: 28 },
    anchorText: "an epistemic commons",
    resolved: true,
    comments: [
      { id: "c-2a", authorName: "Tomás Reyes", body: "The commons metaphor is powerful but risks implying there was a golden age of shared truth. Can you address how the pre-algorithmic information landscape had its own distortions?", createdAt: "2026-03-16T11:00:00Z" },
      { id: "c-2b", authorName: "Dr. Priya Anand", body: "You're right — I've added a paragraph acknowledging that gatekept media had exclusion problems. The claim is about the *type* of degradation, not that we fell from grace.", createdAt: "2026-03-16T14:00:00Z" },
      { id: "c-2c", authorName: "Tomás Reyes", body: "That nuance makes the argument much stronger. Resolving.", createdAt: "2026-03-16T15:00:00Z" },
    ],
  },
  {
    id: "thread-3",
    anchor: { startPath: "5/1", startOffset: 10, endPath: "5/1", endOffset: 55 },
    anchorText: "a 23% decrease in policy-relevant content",
    resolved: false,
    comments: [
      { id: "c-3a", authorName: "Dr. Aisha Mbeki", body: "This statistic is striking. Is this from the 2025 Reuters Institute report? Would be worth citing directly — it's one of the strongest pieces of evidence in the whole article.", createdAt: "2026-03-17T08:00:00Z" },
    ],
  },
];

const MOCK_EDITOR_CONTENT = {
  attention: {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "The Hidden Cost of Attention: How Algorithmic Feeds Reshape Civic Discourse" }] },
      { type: "paragraph", content: [{ type: "text", text: "Every minute, engagement-maximizing recommender systems make billions of micro-decisions about what 4.9 billion people will see next. These systems treat attention as an extractive resource — harvesting it in milliseconds, converting it to ad revenue, and discarding the epistemic residue. The result is an epistemic commons under unprecedented structural pressure." }] },
      { type: "pullQuote", content: [{ type: "text", text: "\"The most consequential editorial decisions in history are now made by loss functions that have never encountered the concept of civic responsibility.\"" }] },
      { type: "paragraph", content: [{ type: "text", text: "Between 2020 and 2025, platforms optimizing for time-on-site produced a 23% decrease in policy-relevant content reaching median users, while emotionally arousing political content saw a 340% amplification. This is not a neutral redistribution — it is a systematic reweighting of what counts as important." }] },
      { type: "callout", attrs: { variant: "info" }, content: [{ type: "text", text: "Key Insight: The problem is not that algorithms have biases — all editorial systems do. The problem is that these biases are optimized against metrics that are structurally misaligned with informed democratic participation." }] },
      { type: "mathBlock", content: [{ type: "text", text: "\\text{Attention}_{\\text{civic}} = \\frac{\\sum_{i} R_i \\cdot s_i}{\\sum_{j} E_j \\cdot \\tau_j} \\quad \\text{where } E_j \\gg R_i" }] },
    ],
  },
  socialChoice: {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Arrow's Impossibility Theorem and the Limits of Preference Aggregation" }] },
      { type: "paragraph", content: [{ type: "text", text: "Kenneth Arrow's 1951 impossibility theorem remains one of the most profound results in social choice theory. It demonstrates that no rank-order voting system with three or more alternatives can simultaneously satisfy a small set of seemingly reasonable fairness conditions. This paper revisits the theorem in the context of deliberative platforms, where preferences are not fixed inputs but evolve through structured argument." }] },
      { type: "pullQuote", content: [{ type: "text", text: "\"The impossibility is not a defect of democracy — it is a proof that collective rationality requires more than the mechanical aggregation of individual rankings.\"" }] },
      { type: "paragraph", content: [{ type: "text", text: "We define a social welfare function F that maps individual preference profiles to a social ordering, and show that the conditions of unrestricted domain, Pareto efficiency, independence of irrelevant alternatives (IIA), and non-dictatorship are jointly inconsistent when the deliberative transformation operator D is absent." }] },
      { type: "callout", attrs: { variant: "info" }, content: [{ type: "text", text: "Key Insight: When preferences are endogenous to deliberation rather than exogenous inputs, the domain restriction that Arrow's theorem requires may arise naturally — not as a constraint imposed on voters, but as a consequence of reasoned exchange." }] },
      { type: "mathBlock", content: [{ type: "text", text: "F: \\mathcal{L}(A)^n \\to \\mathcal{L}(A) \\quad \\text{s.t. } \\nexists\\, F \\text{ satisfying U, P, IIA, ND simultaneously}" }] },
    ],
  },
};

const ARTICLE_TEMPLATES = [
  { id: "standard", label: "Standard", description: "Clean, minimal layout for most articles", icon: FileText },
  { id: "feature", label: "Feature", description: "Magazine-style with hero image and large title", icon: Newspaper },
  { id: "interview", label: "Interview", description: "Q&A format with speaker attribution", icon: MessageCircle },
];

const SLASH_COMMANDS = [
  { title: "Image", description: "Insert an image with alt text and cropping", icon: ImageIcon },
  { title: "Quote", description: "Pull quote — a standout quotation block", icon: Quote },
  { title: "Callout", description: "Info, warning, or tip callout box", icon: AlertCircle },
  { title: "Latex", description: "Math block with KaTeX rendering", icon: Sigma },
];

const TOOLBAR_GROUPS = [
  {
    label: "Text Formatting",
    items: [
      { icon: Bold, label: "Bold" },
      { icon: Italic, label: "Italic" },
      { icon: Underline, label: "Underline" },
      { icon: Strikethrough, label: "Strikethrough" },
      { icon: Code, label: "Inline Code" },
    ],
  },
  {
    label: "Lists & Structure",
    items: [
      { icon: List, label: "Bullet List" },
      { icon: ListOrdered, label: "Ordered List" },
      { icon: ListChecks, label: "Task List" },
      { icon: Quote, label: "Blockquote" },
    ],
  },
  {
    label: "Alignment",
    items: [
      { icon: AlignLeft, label: "Left" },
      { icon: AlignCenter, label: "Center" },
      { icon: AlignRight, label: "Right" },
    ],
  },
  {
    label: "Style Tokens",
    items: [
      { icon: Type, label: "Font Family" },
      { icon: CaseSensitive, label: "Font Size" },
      { icon: ArrowUpDown, label: "Font Weight" },
      { icon: Palette, label: "Text Color" },
      { icon: Highlighter, label: "Highlight" },
    ],
  },
  {
    label: "Insert & Actions",
    items: [
      { icon: Link2, label: "Quick Link" },
      { icon: ImageIcon, label: "Image" },
      { icon: SeparatorHorizontal, label: "Section Break" },
      { icon: Eraser, label: "Clear Formatting" },
    ],
  },
];

const RHETORIC_TYPES = [
  { type: "hedge", label: "Hedge", color: "bg-yellow-100 text-yellow-800 border-yellow-300", example: "It seems plausible that...", description: "Language expressing uncertainty or tentativeness" },
  { type: "intensifier", label: "Intensifier", color: "bg-orange-100 text-orange-800 border-orange-300", example: "Overwhelmingly corrosive", description: "Language amplifying strength of a claim" },
  { type: "absolute", label: "Absolute", color: "bg-red-100 text-red-800 border-red-300", example: "Inevitably degrades...", description: "Universal or totalizing claims" },
  { type: "analogy", label: "Analogy", color: "bg-blue-100 text-blue-800 border-blue-300", example: "Like strip-mining a watershed", description: "Comparisons drawing structural parallels" },
  { type: "metaphor", label: "Metaphor", color: "bg-purple-100 text-purple-800 border-purple-300", example: "The attention economy", description: "Figurative language shaping conceptual framing" },
];

const PHASES = [
  {
    id: "foundational",
    title: "Foundational Features",
    description: "Core article authoring and management",
    features: [
      {
        id: "creation-templates",
        title: "Article Creation & Templates",
        description: "Create articles with template selection for different layouts",
        icon: LayoutTemplate,
        status: "complete" as const,
        items: ["One-click article creation (/article/new)", "Standard, Feature, and Interview templates", "Template selector popover in editor", "Automatic draft creation with localStorage tracking", "Slug generation on publish"],
      },
      {
        id: "rich-editor",
        title: "TipTap Rich Text Editor",
        description: "Full-featured editor with custom nodes and extensions",
        icon: Pencil,
        status: "complete" as const,
        items: ["TipTap with StarterKit (headings, lists, blockquote, code)", "Custom nodes: PullQuote, Callout, MathBlock, MathInline", "Slash commands (/, Image, Quote, Callout, Latex)", "Toolbar with formatting, alignment, style tokens", "CodeBlockLowlight with JS/TS/Python/Bash syntax", "Task lists, text transforms, section breaks"],
      },
      {
        id: "hero-media",
        title: "Hero Image & Media",
        description: "Upload, crop, and manage article hero images",
        icon: ImageIcon,
        status: "complete" as const,
        items: ["Hero image upload to S3", "Image cropping with react-easy-crop", "Alt text for accessibility", "Inline image insertion via slash command", "Template-aware hero rendering"],
      },
      {
        id: "autosave-revisions",
        title: "Autosave & Revision History",
        description: "Never lose work with automatic saving and version snapshots",
        icon: History,
        status: "complete" as const,
        items: ["Debounced autosave (2s delay)", "In-flight request abort for deduplication", "Manual save with \"Saved\" toast", "Revision snapshots on publish", "Revision history viewer (GET /api/articles/[id]/revisions)"],
      },
      {
        id: "dashboard",
        title: "Articles Dashboard",
        description: "Full CRUD management with search, filter, and trash",
        icon: Settings,
        status: "complete" as const,
        items: ["SWR infinite scroll pagination", "Search by title (debounced)", "Filter by status (Draft/Published)", "Filter by template", "Inline title editing", "Soft delete with trash view", "Restore from trash"],
      },
    ],
  },
  {
    id: "phase1",
    title: "Phase 1: Editor Power",
    description: "Advanced editing capabilities and content safety",
    features: [
      {
        id: "custom-nodes",
        title: "Custom Nodes",
        description: "Rich content blocks beyond standard text",
        icon: Sparkles,
        status: "complete" as const,
        items: ["PullQuote — standout quotation blocks", "Callout — info, warning, tip boxes", "MathBlock — full KaTeX equation blocks", "MathInline — inline math expressions", "CustomImage — images with a11y alt text", "SectionBreak — visual content dividers"],
      },
      {
        id: "slash-commands",
        title: "Slash Commands",
        description: "Type / to insert blocks quickly",
        icon: Slash,
        status: "complete" as const,
        items: ["Tippy.js-powered floating menu", "Fuzzy search filtered commands", "Image, Quote, Callout, Latex shortcuts", "Keyboard navigation", "Auto-range deletion after insertion"],
      },
      {
        id: "advanced-toolbar",
        title: "Advanced Toolbar",
        description: "Comprehensive formatting controls",
        icon: Bold,
        status: "complete" as const,
        items: ["Font family selector (System, Founders, Bugrino, etc.)", "Font size (12–48px)", "Font weight (300–800)", "Text color tokens (Accent, Muted, Red)", "Highlight colors (Yellow, Blue, Green, Red)", "Text transforms (uppercase, lowercase, caps, small caps)", "Line height & letter spacing controls"],
      },
      {
        id: "char-count",
        title: "Character Counting & Limits",
        description: "Track content length against 20k character limit",
        icon: Hash,
        status: "complete" as const,
        items: ["Live character count display", "20,000 character limit enforcement", "Visual progress indicator", "Limit warning near threshold"],
      },
      {
        id: "paste-sanitization",
        title: "Paste Sanitization",
        description: "Safe paste handling for external content",
        icon: ShieldCheck,
        status: "complete" as const,
        items: ["DOMPurify HTML sanitization on paste", "Allowed tags whitelist (p, h1-h6, ul, ol, li, etc.)", "Attribute sanitization (href, src, alt only)", "HTML normalization before insertion", "XSS prevention"],
      },
      {
        id: "editor-extensions",
        title: "Editor Extensions",
        description: "TipTap extensions for enhanced editing",
        icon: PlusCircle,
        status: "complete" as const,
        items: ["Indent (tab/shift-tab)", "CodeBlockTab (tab within code blocks)", "MoveBlock (alt+up/down to reorder)", "QuickLink (inline link insertion)", "TextStyleTokens & BlockStyleTokens", "SSR text alignment & text style"],
      },
    ],
  },
  {
    id: "phase2",
    title: "Phase 2: Publishing & Reading",
    description: "Article lifecycle from draft to published reader",
    features: [
      {
        id: "publish-workflow",
        title: "Publish Workflow",
        description: "Draft → Published with metadata generation",
        icon: Newspaper,
        status: "complete" as const,
        items: ["One-click publish from editor", "Unique slug generation (title → kebab-case + dedup)", "Automatic excerpt computation from AST", "Reading time calculation", "Revision snapshot on publish", "Feed post creation (shared to timeline)", "Status toggle (Draft ↔ Published)"],
      },
      {
        id: "template-reader",
        title: "Template-based Reader",
        description: "Different layouts for different article types",
        icon: Eye,
        status: "complete" as const,
        items: ["Standard — clean minimal layout", "Feature — magazine-style with hero", "Interview — Q&A format with speaker tags", "Hero image rendering per template", "Article global styles (ProseMirror)", "Responsive text and image sizing"],
      },
      {
        id: "article-cards",
        title: "Article Cards & Preview",
        description: "Card components with preview modal",
        icon: Maximize2,
        status: "complete" as const,
        items: ["ArticleCard with hero thumbnail", "Preview modal dialog (ArticlePostModal)", "Excerpt and reading time display", "Live link to published article (/article/[slug])", "Fallback for articles without hero images"],
      },
      {
        id: "social-actions",
        title: "Social Actions",
        description: "Like, save, and share articles",
        icon: Heart,
        status: "complete" as const,
        items: ["Optimistic like toggle", "Save/bookmark toggle", "Share to clipboard", "Action count displays", "API: POST /api/articles/[id]/like", "API: POST /api/articles/[id]/save"],
      },
      {
        id: "feed-integration",
        title: "Feed Integration",
        description: "Published articles appear in the platform feed",
        icon: Share2,
        status: "complete" as const,
        items: ["Auto-create FeedPost on publish", "Feed post links to article reader", "Excerpt preview in feed", "Author attribution"],
      },
    ],
  },
  {
    id: "phase3",
    title: "Phase 3: Annotation & Deliberation",
    description: "Collaborative annotation and deep deliberation",
    features: [
      {
        id: "anchored-threads",
        title: "Anchored Comment Threads",
        description: "Select text to start comment threads anchored to article content",
        icon: MessageSquare,
        status: "complete" as const,
        items: ["Text selection → comment creation", "Anchor-based positioning (startPath, startOffset, endPath, endOffset)", "Range normalization to text nodes", "Thread creation via POST /api/articles/[id]/threads", "Thread resolution (mark as resolved)", "allowAnnotations flag per article"],
      },
      {
        id: "comment-rail",
        title: "Comment Rail",
        description: "Sidebar showing comment threads with collision resolution",
        icon: PanelRightOpen,
        status: "complete" as const,
        items: ["Fixed sidebar with thread cards", "Collision resolution (solveCollisions algorithm)", "Active thread highlighting", "Click to scroll to anchor", "Thread clustering for overlapping anchors", "Responsive rail positioning"],
      },
      {
        id: "rhetoric-analysis",
        title: "Rhetoric Analysis Overlays",
        description: "Visual marking of rhetorical patterns in article text",
        icon: Lightbulb,
        status: "complete" as const,
        items: ["Hedge detection (uncertainty language)", "Intensifier marking (amplifying language)", "Absolute claim detection (universal/totalizing)", "Analogy highlighting (structural comparisons)", "Metaphor marking (figurative framing)", "Color-coded CSS overlays"],
      },
      {
        id: "deep-dive",
        title: "Deliberation Panel Integration",
        description: "Connect articles to full deliberation system",
        icon: Scale,
        status: "complete" as const,
        items: ["Debate tab with argument threads", "Arguments list with ASPIC+ framework", "Claim graph visualization", "Ludics / dialogue analysis", "Thesis management", "Analytics and cross-deliberation", "Proposition composer from annotations"],
      },
      {
        id: "proposition-composer",
        title: "Proposition Composer",
        description: "Lift annotations into formal propositions for deliberation",
        icon: GitBranch,
        status: "complete" as const,
        items: ["Select annotation text → compose proposition", "Link proposition to article thread", "Feed into ASPIC+ argument system", "Cross-reference between article and deliberation"],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE OVERVIEW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof PHASES)[0]["features"][0] }) {
  const Icon = feature.icon;

  return (
    <Card className="h-full bg-white/80 backdrop-blur border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
              <CardDescription className="text-sm">{feature.description}</CardDescription>
            </div>
          </div>
          <Badge variant="default" className="bg-emerald-600 shadow-sm">
            <Check className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {feature.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Article Editor
// ─────────────────────────────────────────────────────────────────────────────

function ArticleEditorDemo() {
  const [activeArticle, setActiveArticle] = useState<ArticleKey>("attention");
  const article = MOCK_ARTICLES[activeArticle];
  const [selectedTemplate, setSelectedTemplate] = useState("feature");
  const [charCount, setCharCount] = useState(1847);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const filteredCommands = SLASH_COMMANDS.filter((c) =>
    c.title.toLowerCase().includes(slashFilter.toLowerCase())
  );

  const simulateSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Article saved");
    }, 800);
  };

  return (
    <Card className="bg-white/90 backdrop-blur border-amber-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="w-5 h-5" />
          Article Editor
          <Badge className="ml-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs shadow-sm">Interactive</Badge>
        </CardTitle>
        <CardDescription>
          TipTap-powered rich text editor with custom nodes, slash commands, and toolbar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Article Switcher */}
        <div>
          <p className="text-sm font-medium mb-2">Demo Article:</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveArticle("attention"); setSelectedTemplate("feature"); setCharCount(1847); }}
              className={`flex-1 text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                activeArticle === "attention"
                  ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <p className="font-medium text-slate-800">The Hidden Cost of Attention</p>
              <p className="text-xs text-slate-500 mt-0.5">Feature · Civic discourse & algorithms</p>
            </button>
            <button
              onClick={() => { setActiveArticle("socialChoice"); setSelectedTemplate("standard"); setCharCount(4231); }}
              className={`flex-1 text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                activeArticle === "socialChoice"
                  ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <p className="font-medium text-slate-800">Arrow&apos;s Impossibility Theorem</p>
              <p className="text-xs text-slate-500 mt-0.5">Standard · Formal social choice theory</p>
            </button>
          </div>
        </div>

        {/* Template Selector */}
        <div>
          <p className="text-sm font-medium mb-2">Template:</p>
          <div className="flex gap-2">
            {ARTICLE_TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t.id);
                    toast.info(`Template: ${t.label} — ${t.description}`);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-all ${
                    selectedTemplate === t.id
                      ? "border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-200"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor Toolbar Visualization */}
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="border-b bg-slate-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1">
              {TOOLBAR_GROUPS.map((group, gi) => (
                <div key={gi} className="flex items-center gap-0.5">
                  {group.items.map((item, ii) => {
                    const Icon = item.icon;
                    return (
                      <Tooltip key={ii}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toast.info(`${item.label} — ${group.label}`)}
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {gi < TOOLBAR_GROUPS.length - 1 && <div className="w-px h-5 bg-slate-300 mx-1" />}
                </div>
              ))}
            </div>
          </div>

          {/* Editor Body */}
          <div className="p-4 min-h-[200px] text-sm relative">
            {/* Hero Image Placeholder */}
            {selectedTemplate === "feature" && (
              <div className="mb-4 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-dashed border-amber-300 h-32 flex items-center justify-center text-amber-500 cursor-pointer hover:bg-amber-50 transition-colors"
                onClick={() => toast.info("Upload hero image — supports crop, alt text, S3 upload")}
              >
                <div className="text-center">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                  <p className="text-xs">Click to upload hero image</p>
                </div>
              </div>
            )}

            {/* Simulated Content */}
            <h1 className="text-2xl font-bold mb-3">{article.title}</h1>

            {activeArticle === "attention" ? (
              <>
                <p className="text-slate-600 mb-3">
                  Every minute, engagement-maximizing recommender systems make billions of micro-decisions about what 4.9 billion people will see next. These systems treat attention as{" "}
                  <span className="bg-yellow-100 border-b-2 border-yellow-400">an extractive resource</span>
                  {" "}— harvesting it in milliseconds, converting it to ad revenue, and discarding the epistemic residue.
                </p>

                {/* PullQuote Node */}
                <div className="border-l-4 border-amber-400 bg-amber-50/50 px-4 py-3 my-3 italic text-slate-700">
                  &ldquo;The most consequential editorial decisions in history are now made by loss functions that have never encountered the concept of civic responsibility.&rdquo;
                </div>

                {/* Callout Node */}
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 my-3 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-700">Key Insight</p>
                    <p className="text-sm text-blue-600">The problem is not that algorithms have biases — all editorial systems do. The problem is that these biases are optimized against metrics structurally misaligned with informed democratic participation.</p>
                  </div>
                </div>

                {/* Math Block Node */}
                <div className="rounded-lg border bg-slate-50 px-4 py-3 my-3 text-center font-mono text-sm text-slate-700">
                  Attention<sub>civic</sub> = Σ R<sub>i</sub> · s<sub>i</sub> / Σ E<sub>j</sub> · τ<sub>j</sub> &nbsp; where E<sub>j</sub> ≫ R<sub>i</sub>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-600 mb-3">
                  Kenneth Arrow&apos;s 1951 impossibility theorem remains one of the most profound results in social choice theory. It demonstrates that no rank-order voting system with{" "}
                  <span className="bg-yellow-100 border-b-2 border-yellow-400">three or more alternatives</span>
                  {" "}can simultaneously satisfy a small set of seemingly reasonable fairness conditions.
                </p>

                {/* PullQuote Node */}
                <div className="border-l-4 border-amber-400 bg-amber-50/50 px-4 py-3 my-3 italic text-slate-700">
                  &ldquo;The impossibility is not a defect of democracy — it is a proof that collective rationality requires more than the mechanical aggregation of individual rankings.&rdquo;
                </div>

                {/* Definition Block — math-heavy */}
                <div className="rounded-lg border bg-slate-50 px-4 py-3 my-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Definition 1 — Social Welfare Function</p>
                  <div className="text-center font-mono text-sm text-slate-700">
                    F : L(A)<sup>n</sup> → L(A)
                  </div>
                  <p className="text-xs text-slate-500 text-center">Maps a profile of n individual orderings over alternative set A to a single social ordering.</p>
                </div>

                {/* Theorem Block */}
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50/30 px-4 py-3 my-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Theorem (Arrow, 1951)</p>
                  <p className="text-sm text-slate-700">If |A| ≥ 3, there exists no social welfare function F satisfying all of:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-1">
                    <div className="rounded bg-white border px-2 py-1"><strong>U</strong> — Unrestricted Domain</div>
                    <div className="rounded bg-white border px-2 py-1"><strong>P</strong> — Pareto Efficiency</div>
                    <div className="rounded bg-white border px-2 py-1"><strong>IIA</strong> — Independence of Irrelevant Alternatives</div>
                    <div className="rounded bg-white border px-2 py-1"><strong>ND</strong> — Non-Dictatorship</div>
                  </div>
                </div>

                {/* Callout Node */}
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 my-3 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-700">Key Insight</p>
                    <p className="text-sm text-blue-600">When preferences are endogenous to deliberation rather than fixed inputs, the domain restriction Arrow requires may arise naturally — as a consequence of reasoned exchange, not an imposed constraint.</p>
                  </div>
                </div>

                {/* Math Block Nodes — multiple equations */}
                <div className="rounded-lg border bg-slate-50 px-4 py-3 my-3 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Formal Statement</p>
                  <div className="text-center font-mono text-sm text-slate-700">
                    ∄ F : L(A)<sup>n</sup> → L(A) satisfying U ∧ P ∧ IIA ∧ ND
                  </div>
                  <div className="border-t pt-2 text-center font-mono text-sm text-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Deliberative transformation operator:</p>
                    D(R<sub>1</sub>, …, R<sub>n</sub>) = (R&apos;<sub>1</sub>, …, R&apos;<sub>n</sub>) where R&apos;<sub>i</sub> ∈ L<sub>SR</sub>(A) ⊂ L(A)
                  </div>
                  <div className="border-t pt-2 text-center font-mono text-sm text-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Sen&apos;s value restriction (sufficient for transitivity):</p>
                    ∀ &#123;x, y, z&#125; ⊆ A, ∃ rank r : ¬∃ i (x R<sub>i</sub> y R<sub>i</sub> z with rank r)
                  </div>
                </div>

                {/* Inline Math Example */}
                <p className="text-slate-600 mb-3">
                  The key move is recognizing that the deliberative operator <span className="font-mono text-sm bg-slate-100 px-1 rounded">D</span> produces
                  single-peaked preferences over the latent dimension of the deliberation topic, satisfying Sen&apos;s
                  value restriction. Under single-peakedness, majority rule yields a transitive social ordering — the
                  median voter&apos;s peak <span className="font-mono text-sm bg-slate-100 px-1 rounded">x<sup>*</sup> = med(x<sub>1</sub><sup>*</sup>, …, x<sub>n</sub><sup>*</sup>)</span> is
                  a Condorcet winner.
                </p>
              </>
            )}

            {/* Slash Command Popup */}
            {showSlashMenu && (
              <div className="absolute z-10 left-4 top-[60%] bg-white border rounded-lg shadow-lg p-1 min-w-[200px]">
                {filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.title}
                      onClick={() => {
                        setShowSlashMenu(false);
                        setSlashFilter("");
                        toast.success(`Inserted: ${cmd.title}`);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 rounded text-left"
                    >
                      <Icon className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="font-medium">{cmd.title}</p>
                        <p className="text-xs text-slate-500">{cmd.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Editor Footer */}
          <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
            <div className="flex items-center gap-3">
              <span className={charCount > 18000 ? "text-red-500 font-medium" : ""}>
                {charCount.toLocaleString()} / 20,000 characters
              </span>
              <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${charCount > 18000 ? "bg-red-500" : charCount > 15000 ? "bg-amber-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min((charCount / 20000) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowSlashMenu(!showSlashMenu);
                  setSlashFilter("");
                }}
                className="px-2 py-1 rounded hover:bg-slate-200 transition-colors flex items-center gap-1"
              >
                <Slash className="w-3 h-3" />
                Slash Commands
              </button>
              <button
                onClick={simulateSave}
                className="px-2 py-1 rounded hover:bg-slate-200 transition-colors flex items-center gap-1"
              >
                <Save className="w-3 h-3" />
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Section Break Demo */}
        <div className="flex items-center gap-4 py-2">
          <div className="flex-1 h-px bg-slate-300" />
          <span className="text-xs text-slate-400">Section Break</span>
          <div className="flex-1 h-px bg-slate-300" />
        </div>

        {/* Extensions Reference */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { icon: Indent, label: "Tab Indent" },
            { icon: Code, label: "Code Block (Lowlight)" },
            { icon: GripVertical, label: "Block Move (Alt+↕)" },
            { icon: Link2, label: "Quick Link" },
            { icon: SeparatorHorizontal, label: "Section Break" },
            { icon: Scissors, label: "Paste Sanitize" },
          ].map((ext) => {
            const Icon = ext.icon;
            return (
              <button
                key={ext.label}
                onClick={() => toast.info(`Extension: ${ext.label}`)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-slate-50 text-sm transition-colors"
              >
                <Icon className="w-4 h-4 text-slate-500" />
                {ext.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Publishing & Reader
// ─────────────────────────────────────────────────────────────────────────────

function PublishingDemo() {
  const [activeArticle, setActiveArticle] = useState<ArticleKey>("attention");
  const article = MOCK_ARTICLES[activeArticle];
  const [articleStatus, setArticleStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [isPublishing, setIsPublishing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(24);

  const simulatePublish = () => {
    if (articleStatus === "PUBLISHED") {
      setArticleStatus("DRAFT");
      toast.info("Reverted to draft");
      return;
    }
    setIsPublishing(true);
    setTimeout(() => {
      setArticleStatus("PUBLISHED");
      setIsPublishing(false);
      toast.success("Published! Slug generated, excerpt computed, feed post created.");
    }, 1200);
  };

  return (
    <Card className="bg-white/90 backdrop-blur border-orange-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          Publishing & Reading
          <Badge className="ml-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs shadow-sm">Interactive</Badge>
        </CardTitle>
        <CardDescription>
          Publish workflow, template-based reader, article cards, and social actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Article Switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveArticle("attention"); setArticleStatus("DRAFT"); }}
            className={`flex-1 text-left px-3 py-2 rounded-lg border text-sm transition-all ${
              activeArticle === "attention" ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="font-medium text-sm">The Hidden Cost of Attention</p>
            <p className="text-xs text-slate-500">Feature article</p>
          </button>
          <button
            onClick={() => { setActiveArticle("socialChoice"); setArticleStatus("DRAFT"); }}
            className={`flex-1 text-left px-3 py-2 rounded-lg border text-sm transition-all ${
              activeArticle === "socialChoice" ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="font-medium text-sm">Arrow&apos;s Impossibility Theorem</p>
            <p className="text-xs text-slate-500">Academic article</p>
          </button>
        </div>

        {/* Publish Workflow */}
        <div className="border rounded-lg bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{article.title}</p>
              <p className="text-xs text-slate-500">By {article.author.name}</p>
            </div>
            <Badge className={articleStatus === "PUBLISHED" ? "bg-emerald-600" : "bg-slate-500"}>
              {articleStatus}
            </Badge>
          </div>

          {/* Publish Steps */}
          <div className="space-y-2">
            {[
              { step: "Generate slug", detail: `"${article.slug}"`, done: articleStatus === "PUBLISHED" },
              { step: "Compute excerpt", detail: `${article.excerpt?.slice(0, 50)}...`, done: articleStatus === "PUBLISHED" },
              { step: "Calculate reading time", detail: `${article.readingTime} min read`, done: articleStatus === "PUBLISHED" },
              { step: "Create revision snapshot", detail: "Immutable point-in-time copy", done: articleStatus === "PUBLISHED" },
              { step: "Create feed post", detail: "Article shared to platform feed", done: articleStatus === "PUBLISHED" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  s.done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                }`}>
                  {s.done ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{s.step}</span>
                  <span className="text-slate-500 ml-2">— {s.detail}</span>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={simulatePublish}
            disabled={isPublishing}
            className={articleStatus === "PUBLISHED"
              ? "bg-slate-600 hover:bg-slate-700"
              : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            }
          >
            {isPublishing ? "Publishing..." : articleStatus === "PUBLISHED" ? "Revert to Draft" : "Publish Article"}
          </Button>
        </div>

        {/* Article Card Preview */}
        <div>
          <p className="text-sm font-medium mb-2">Article Card:</p>
          <div className="border rounded-lg bg-white overflow-hidden max-w-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => toast.info("Preview modal — fetches from /api/articles/preview")}
          >
            <div className="h-36 bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-amber-300" />
            </div>
            <div className="p-3">
              <p className="font-medium text-sm">{article.title}</p>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{article.excerpt}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {article.readingTime} min</span>
                <span>{article.author.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Social Actions */}
        <div>
          <p className="text-sm font-medium mb-2">Social Actions:</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLiked(!liked);
                setLikeCount(liked ? likeCount - 1 : likeCount + 1);
                toast.success(liked ? "Unliked" : "Liked (optimistic)");
              }}
              className={liked ? "text-red-500 border-red-200 bg-red-50" : ""}
            >
              <Heart className="w-4 h-4 mr-1" fill={liked ? "currentColor" : "none"} />
              {likeCount}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSaved(!saved);
                toast.success(saved ? "Unsaved" : "Saved to bookmarks");
              }}
              className={saved ? "text-blue-500 border-blue-200 bg-blue-50" : ""}
            >
              <Bookmark className="w-4 h-4 mr-1" fill={saved ? "currentColor" : "none"} />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("Link copied to clipboard")}
            >
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </Button>
          </div>
        </div>

        {/* Revision History */}
        <div>
          <p className="text-sm font-medium mb-2">Revision History:</p>
          <div className="border rounded-lg bg-white divide-y max-h-48 overflow-y-auto">
            {MOCK_REVISIONS.map((rev, i) => (
              <button
                key={rev.id}
                onClick={() => toast.info(`Load revision: ${rev.label} (${rev.id})`)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span>{rev.label}</span>
                  {i === 0 && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Latest</Badge>}
                </div>
                <span className="text-xs text-slate-400">{new Date(rev.createdAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Annotation System
// ─────────────────────────────────────────────────────────────────────────────

function AnnotationDemo() {
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [showRhetoric, setShowRhetoric] = useState(false);
  const [resolvedThreads, setResolvedThreads] = useState<Set<string>>(new Set(["thread-2"]));

  const toggleResolve = (threadId: string) => {
    setResolvedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
        toast.info("Thread reopened");
      } else {
        next.add(threadId);
        toast.success("Thread resolved");
      }
      return next;
    });
  };

  return (
    <Card className="bg-white/90 backdrop-blur border-rose-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Annotation & Deliberation
          <Badge className="ml-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs shadow-sm">Interactive</Badge>
        </CardTitle>
        <CardDescription>
          Select text to annotate, comment rail with collision resolution, rhetoric analysis, and deliberation integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Annotated Article View */}
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="flex">
            {/* Article Content */}
            <div className="flex-1 p-4 text-sm space-y-3">
              <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                <Crosshair className="w-3 h-3" /> Select text to create annotations (simulated)
              </p>
              <p className="text-slate-700">
                Every minute,{" "}
                <span
                  className={`cursor-pointer border-b-2 transition-colors ${
                    activeThread === "thread-1"
                      ? "bg-amber-200 border-amber-400"
                      : "bg-amber-100/50 border-amber-300/50 hover:bg-amber-100"
                  }`}
                  onClick={() => {
                    setActiveThread(activeThread === "thread-1" ? null : "thread-1");
                    toast.info("Thread: engagement-maximizing recommender systems");
                  }}
                >
                  engagement-maximizing recommender systems
                </span>{" "}
                make billions of micro-decisions about what 4.9 billion people will see next.
              </p>
              <p className="text-slate-700">
                The result is{" "}
                <span
                  className={`cursor-pointer border-b-2 transition-colors ${
                    activeThread === "thread-2"
                      ? "bg-green-200 border-green-400"
                      : resolvedThreads.has("thread-2")
                        ? "bg-green-100/30 border-green-300/30 hover:bg-green-100/50"
                        : "bg-amber-100/50 border-amber-300/50 hover:bg-amber-100"
                  }`}
                  onClick={() => {
                    setActiveThread(activeThread === "thread-2" ? null : "thread-2");
                    toast.info("Thread: an epistemic commons (resolved)");
                  }}
                >
                  an epistemic commons
                </span>{" "}
                under unprecedented structural pressure — where nuance is taxed and outrage is subsidized.
              </p>
              <p className="text-slate-700">
                Between 2020 and 2025, platforms produced{" "}
                <span
                  className={`cursor-pointer border-b-2 transition-colors ${
                    activeThread === "thread-3"
                      ? "bg-amber-200 border-amber-400"
                      : "bg-amber-100/50 border-amber-300/50 hover:bg-amber-100"
                  }`}
                  onClick={() => {
                    setActiveThread(activeThread === "thread-3" ? null : "thread-3");
                    toast.info("Thread: a 23% decrease in policy-relevant content");
                  }}
                >
                  a 23% decrease in policy-relevant content
                </span>{" "}
                reaching median users, while emotionally arousing political content saw a 340% amplification.
              </p>

              {/* Rhetoric Overlays */}
              {showRhetoric && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs font-medium text-slate-500 mb-2">Rhetoric Analysis:</p>
                  <p className="text-slate-700">
                    <span className="bg-yellow-100 border-b border-yellow-400 px-0.5">It seems plausible</span> that algorithmic curation{" "}
                    <span className="bg-red-100 border-b border-red-400 px-0.5">inevitably</span> degrades civic attention.{" "}
                    The effect is <span className="bg-orange-100 border-b border-orange-400 px-0.5">overwhelmingly corrosive</span> to informed self-governance,{" "}
                    <span className="bg-blue-100 border-b border-blue-400 px-0.5">like strip-mining a watershed</span> — where{" "}
                    <span className="bg-purple-100 border-b border-purple-400 px-0.5">the attention economy</span> extracts value while externalizing the cost.
                  </p>
                </div>
              )}
            </div>

            {/* Comment Rail */}
            <div className="w-64 border-l bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">Comment Rail</p>
                <Badge variant="outline" className="text-xs">{MOCK_THREADS.length} threads</Badge>
              </div>
              {MOCK_THREADS.map((thread) => {
                const isActive = activeThread === thread.id;
                const isResolved = resolvedThreads.has(thread.id);
                return (
                  <button
                    key={thread.id}
                    onClick={() => setActiveThread(isActive ? null : thread.id)}
                    className={`w-full text-left rounded-lg border p-2 text-xs transition-all ${
                      isActive
                        ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200"
                        : isResolved
                          ? "border-green-200 bg-green-50/50 opacity-60"
                          : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-700 truncate">&ldquo;{thread.anchorText.slice(0, 25)}...&rdquo;</span>
                      {isResolved && <Check className="w-3 h-3 text-green-500" />}
                    </div>
                    <p className="text-slate-500 line-clamp-2">{thread.comments[0].body}</p>
                    <p className="text-slate-400 mt-1">{thread.comments.length} comment{thread.comments.length !== 1 ? "s" : ""}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Thread Detail */}
        {activeThread && (
          <div className="border rounded-lg bg-white p-4 space-y-3">
            {MOCK_THREADS.filter((t) => t.id === activeThread).map((thread) => (
              <div key={thread.id}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">Thread on: &ldquo;{thread.anchorText}&rdquo;</p>
                    <p className="text-xs text-slate-500">Anchor: {thread.anchor.startPath}[{thread.anchor.startOffset}] → {thread.anchor.endPath}[{thread.anchor.endOffset}]</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleResolve(thread.id)}
                    className={resolvedThreads.has(thread.id) ? "text-green-600" : ""}
                  >
                    {resolvedThreads.has(thread.id) ? "Reopen" : "Resolve"}
                  </Button>
                </div>
                <div className="space-y-2">
                  {thread.comments.map((c) => (
                    <div key={c.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                          {c.authorName.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <span className="text-sm font-medium">{c.authorName}</span>
                        <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 ml-8">{c.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rhetoric Analysis Toggle */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Rhetoric Analysis Overlays:</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowRhetoric(!showRhetoric);
                toast.info(showRhetoric ? "Rhetoric overlays hidden" : "Rhetoric overlays shown");
              }}
            >
              <Lightbulb className="w-4 h-4 mr-1" />
              {showRhetoric ? "Hide" : "Show"} Rhetoric
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {RHETORIC_TYPES.map((r) => (
              <div
                key={r.type}
                className={`rounded-lg border p-2 text-center ${r.color}`}
              >
                <p className="text-xs font-medium">{r.label}</p>
                <p className="text-xs mt-0.5 opacity-70">{r.example}</p>
              </div>
            ))}
          </div>
        </div>

        {/* deliberation Integration */}
        <div className="border rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-5 h-5 text-slate-600" />
            <p className="text-sm font-medium">Deliberation Panel Integration</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { icon: MessageSquare, label: "Debate", desc: "Argument threads" },
              { icon: Layers, label: "Arguments", desc: "ASPIC+ framework" },
              { icon: GitBranch, label: "Claims", desc: "Graph visualization" },
              { icon: BarChart3, label: "Analytics", desc: "Deliberation metrics" },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.label}
                  onClick={() => toast.info(`Deliberation: ${tab.label} — ${tab.desc}`)}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                >
                  <Icon className="w-5 h-5 text-slate-500" />
                  <p className="text-xs font-medium">{tab.label}</p>
                  <p className="text-xs text-slate-400">{tab.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Articles Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function DashboardDemo() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "PUBLISHED">("ALL");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [view, setView] = useState<"active" | "trash">("active");
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const filteredArticles = MOCK_ARTICLES_LIST.filter((a) => {
    if (view === "trash") return trashedIds.has(a.id);
    if (trashedIds.has(a.id)) return false;
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    if (templateFilter !== "all" && a.template !== templateFilter) return false;
    return true;
  });

  return (
    <Card className="bg-white/90 backdrop-blur border-slate-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Articles Dashboard
          <Badge className="ml-2 bg-gradient-to-r from-slate-500 to-slate-700 text-white text-xs shadow-sm">Interactive</Badge>
        </CardTitle>
        <CardDescription>
          Full CRUD management with search, filter, trash/restore, and inline editing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search articles..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            {(["ALL", "DRAFT", "PUBLISHED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-amber-100 text-amber-700 border border-amber-300"
                    : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                {s === "ALL" ? "All" : s === "DRAFT" ? "Drafts" : "Published"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {[{ id: "all", label: "All" }, ...ARTICLE_TEMPLATES].map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplateFilter(t.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  templateFilter === t.id
                    ? "bg-orange-100 text-orange-700 border border-orange-300"
                    : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView("active")}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                view === "active" ? "bg-slate-200 text-slate-700" : "bg-white border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setView("trash")}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                view === "trash" ? "bg-red-100 text-red-700" : "bg-white border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Trash2 className="w-3 h-3 inline mr-1" />
              Trash {trashedIds.size > 0 && `(${trashedIds.size})`}
            </button>
          </div>
        </div>

        {/* Article List */}
        <div className="border rounded-lg bg-white divide-y">
          {filteredArticles.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              {view === "trash" ? "Trash is empty" : "No articles match your filters"}
            </div>
          ) : (
            filteredArticles.map((article) => (
              <div key={article.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                {/* Hero Thumb */}
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border flex items-center justify-center flex-shrink-0">
                  {article.heroImageKey ? (
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                  ) : (
                    <FileText className="w-4 h-4 text-slate-300" />
                  )}
                </div>

                {/* Title & Meta */}
                <div className="flex-1 min-w-0">
                  {editingTitleId === article.id ? (
                    <input
                      className="text-sm font-medium border rounded px-2 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-amber-200"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setEditingTitleId(null);
                          toast.success(`Title updated to "${editingTitle}"`);
                        }
                        if (e.key === "Escape") setEditingTitleId(null);
                      }}
                      onBlur={() => setEditingTitleId(null)}
                      autoFocus
                    />
                  ) : (
                    <p
                      className="text-sm font-medium truncate cursor-pointer hover:text-amber-700"
                      onClick={() => {
                        setEditingTitleId(article.id);
                        setEditingTitle(article.title);
                      }}
                    >
                      {article.title}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{article.template}</span>
                    {article.readingTime && <span>· {article.readingTime} min read</span>}
                    <span>· {new Date(article.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Status Badge */}
                <Badge variant="outline" className={`text-xs ${
                  article.status === "PUBLISHED" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-600"
                }`}>
                  {article.status}
                </Badge>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {view === "trash" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            setTrashedIds((prev) => {
                              const next = new Set(prev);
                              next.delete(article.id);
                              return next;
                            });
                            toast.success("Article restored");
                          }}
                          className="p-1.5 rounded hover:bg-green-100 text-green-600"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Restore</TooltipContent>
                    </Tooltip>
                  ) : (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toast.info(`Edit: /article/by-id/${article.id}/edit`)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      {article.slug && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => toast.info(`View: /article/${article.slug}`)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>View</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setTrashedIds((prev) => new Set(prev).add(article.id));
                              toast.info("Moved to trash (soft delete)");
                            }}
                            className="p-1.5 rounded hover:bg-red-100 text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Move to Trash</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create New */}
        <button
          onClick={() => toast.info("POST /api/articles → new draft → redirect to /article/by-id/{id}/edit")}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Article
        </button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ArticleFeaturesPage() {
  return (
    <TooltipProvider>
      <Toaster richColors position="bottom-right" />
      <div
        className="min-h-screen bg-[#fef9f7]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(251, 191, 36, 0.08), transparent),
            radial-gradient(ellipse 60% 40% at 80% 50%, rgba(249, 115, 22, 0.06), transparent),
            radial-gradient(ellipse 60% 40% at 20% 80%, rgba(244, 63, 94, 0.05), transparent)
          `,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 mb-4">
              <FileText className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">Article System</span>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 via-orange-600 to-rose-600 bg-clip-text text-transparent">
              Article Features Demo
            </h1>
            <p className="text-slate-500 mt-3 max-w-2xl mx-auto">
              End-to-end article authoring, publishing, reading, annotation, and deliberation —
              from TipTap editor with custom nodes to anchored comment threads and deliberation integration.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Badge className="bg-emerald-600 shadow-sm">
                <Check className="w-3 h-3 mr-1" />
                {PHASES.reduce((sum, p) => sum + p.features.length, 0)} Features Complete
              </Badge>
              <Badge variant="outline" className="border-amber-300 text-amber-700">
                {PHASES.length} Phases
              </Badge>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="w-full justify-start bg-white/80 backdrop-blur border border-slate-200/60 shadow-sm p-1 rounded-xl">
              <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg">
                Overview
              </TabsTrigger>
              <TabsTrigger value="editor" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg">
                Editor
              </TabsTrigger>
              <TabsTrigger value="publishing" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg">
                Publishing
              </TabsTrigger>
              <TabsTrigger value="annotations" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg">
                Annotations
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg">
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="implementation" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg">
                Implementation
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-8">
              {PHASES.map((phase) => (
                <div key={phase.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-bold">{phase.title}</h2>
                    <p className="text-sm text-slate-500">— {phase.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {phase.features.map((f) => (
                      <FeatureCard key={f.id} feature={f} />
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Editor Tab */}
            <TabsContent value="editor" className="space-y-6">
              <ArticleEditorDemo />
            </TabsContent>

            {/* Publishing Tab */}
            <TabsContent value="publishing" className="space-y-6">
              <PublishingDemo />
            </TabsContent>

            {/* Annotations Tab */}
            <TabsContent value="annotations" className="space-y-6">
              <AnnotationDemo />
            </TabsContent>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              <DashboardDemo />
            </TabsContent>

            {/* Implementation Tab */}
            <TabsContent value="implementation" className="space-y-6">
              {/* Architecture Overview */}
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Article Architecture Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-amber-300">Editor Components</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/ArticleEditor.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/editor/Toolbar.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/editor/SlashCommand.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/editor/TemplateSelector.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/templates.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/(editor)/article/by-id/[id]/edit/page.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/(editor)/article/new/page.tsx</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-amber-300">TipTap Extensions</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/tiptap/extensions/shared.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/tiptap/extensions/indent.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/tiptap/extensions/code-tab.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/tiptap/extensions/block-move.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/tiptap/extensions/quick-link.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/tiptap/extensions/sectionBreak.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/tiptap/extensions/text-style-ssr.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/tiptap/extensions/block-style-ssr.ts</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-amber-300">Reader & Actions</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/ArticleReader.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/ArticleReaderWithPins.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/ArticleActions.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/ArticleCard.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/article/CommentSidebar.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/modals/ArticlePostModal.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/article/rhetoric.css</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    API Routes & Data Layer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-orange-300">Article CRUD</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> GET /api/articles (paginated list)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/articles (create draft)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> GET /api/articles/[id] (fetch by ID)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> PATCH /api/articles/[id] (update)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> DELETE /api/articles/[id] (soft delete)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/articles/[id]/restore</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> GET /api/articles/preview</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-orange-300">Publishing & Social</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/articles/[id]/publish</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> GET /api/articles/[id]/revisions</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/articles/[id]/like</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/articles/[id]/save</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/article/text.ts (excerpt, readingTime)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-orange-300">Annotations & Threads</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> GET /api/articles/[id]/threads</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> POST /api/articles/[id]/threads</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> types/comments.ts (Anchor, Thread)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/deepdive/DeepDivePanelV2.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Prisma: Article, Revision models</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-300">Architecture:</strong>{" "}
                      TipTap editor with custom nodes (PullQuote, Callout, MathBlock, MathInline, CustomImage, SectionBreak) •
                      Debounced autosave with inflight abort •
                      DOMPurify paste sanitization •
                      Revision snapshots on publish •
                      Anchor-based comment threads with collision resolution •
                      Deliberation panel for deliberation •
                      Rhetoric analysis overlays (CSS-based)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Dashboard & Infra Reference */}
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Dashboard & Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-rose-300">Dashboard</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/(root)/.../ArticlesDashboard.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> SWR infinite scroll pagination</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Search, status, template filters</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Inline title editing (PATCH)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Soft delete + trash/restore</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-rose-300">Prisma Schema</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Article (id, title, slug, template...)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Revision (id, articleId, astJson)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Status enum: DRAFT | PUBLISHED</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Soft delete: deletedAt timestamp</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Indexes: [authorId, deletedAt, updatedAt]</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-rose-300">Storage & Media</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> S3 hero image upload</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> react-easy-crop for image cropping</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Alt text for accessibility</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> AST JSON stored in Prisma</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Y.js collab ready (disabled)</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="text-center text-sm text-slate-400 pb-10 pt-4 border-t border-slate-200/60">
            <p>Article Features Demo • Foundational + Phase 1–3 Complete • Isonomia Platform</p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
