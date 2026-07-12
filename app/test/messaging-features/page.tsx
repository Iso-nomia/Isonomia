"use client";

/**
 * Messaging Features Demo Page
 *
 * Interactive demonstration of all messaging system features:
 *
 * FOUNDATIONAL FEATURES:
 * - Conversations (1:1 DMs, Group chats)
 * - Message Layers (multi-audience messages with access controls)
 * - Real-time messaging (Supabase broadcast)
 * - Message Composer (rich text, attachments)
 * - Private Chat (floating DM panes)
 *
 * PHASE 1 – RICH MESSAGES:
 * - 1.1 Message Layers & Audience Selectors
 * - 1.2 Stars & Bookmarks
 * - 1.3 Reactions (emoji aggregation)
 * - 1.4 Quoting / Reply
 * - 1.5 Link Previews
 * - 1.6 Message Editing & Locking
 *
 * PHASE 2 – DRIFTS & THREADS:
 * - 2.1 Drifts (side conversations branching from anchor messages)
 * - 2.2 Threads (rooted reply chains)
 * - 2.3 Drift Member Preferences (pin, mute, collapse)
 * - 2.4 Drift Chips (inline UI for drift navigation)
 *
 * PHASE 3 – PROPOSALS & POLLS:
 * - 3.1 Proposals (suggested edits with approve/block/merge workflow)
 * - 3.2 Polls (OPTIONS multi-choice, TEMP temperature checks)
 * - 3.3 Read Receipts & Acknowledgments
 * - 3.4 Message Forwarding with Access Controls
 *
 * Accessible at: /test/messaging-features
 */

import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  MessageSquare,
  Send,
  Star,
  Bookmark,
  SmilePlus,
  Quote,
  Link2,
  Lock,
  Pencil,
  GitBranch,
  MessageCircle,
  Pin,
  BellOff,
  ChevronDown,
  Vote,
  BarChart3,
  CheckCheck,
  Forward,
  Users,
  User,
  Shield,
  Eye,
  EyeOff,
  Timer,
  Paperclip,
  Image as ImageIcon,
  Layers,
  Split,
  Check,
  ChevronRight,
  ExternalLink,
  Settings,
  PlusCircle,
  Sparkles,
  BookOpen,
  Hash,
  ThumbsUp,
  ThumbsDown,
  Merge,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CONVERSATION = {
  id: "conv-demo-1",
  title: "Climate Policy Working Group",
  isGroup: true,
  participants: [
    { id: "user-1", name: "Dr. Jane Smith", image: null },
    { id: "user-2", name: "Alex Chen", image: null },
    { id: "user-3", name: "Maria Garcia", image: null },
    { id: "user-4", name: "Thomas Lee", image: null },
  ],
  lastMessage: "I think we should revisit the carbon tax proposal",
  lastAt: "2026-03-29T14:30:00Z",
};

const MOCK_MESSAGES: MockMessage[] = [
  {
    id: "msg-1",
    text: "Has anyone reviewed the latest IPCC report? The findings on tipping points are critical.",
    senderId: "user-1",
    senderName: "Dr. Jane Smith",
    createdAt: "2026-03-28T10:00:00Z",
    starred: true,
    bookmarked: false,
    reactions: [
      { emoji: "👍", count: 3, mine: false },
      { emoji: "🔥", count: 1, mine: true },
    ],
    facets: [
      {
        id: "facet-1a",
        audience: { kind: "EVERYONE" },
        sharePolicy: "ALLOW" as const,
        body: "Has anyone reviewed the latest IPCC report? The findings on tipping points are critical.",
        priorityRank: 0,
      },
    ],
  },
  {
    id: "msg-2",
    text: "Yes! I wrote up a summary with some annotations. Let me share the key points here.",
    senderId: "user-2",
    senderName: "Alex Chen",
    createdAt: "2026-03-28T10:15:00Z",
    starred: false,
    bookmarked: true,
    reactions: [{ emoji: "🙏", count: 2, mine: false }],
    quotes: [{ sourceMessageId: "msg-1", status: "ok" as const, body: "Has anyone reviewed the latest IPCC report?" }],
    linkPreviews: [
      { urlHash: "lp-1", url: "https://ipcc.ch/report/2025", title: "IPCC Sixth Assessment Report", desc: "Latest climate assessment findings", image: null, status: "ok" },
    ],
  },
  {
    id: "msg-3",
    text: null,
    senderId: "user-3",
    senderName: "Maria Garcia",
    createdAt: "2026-03-28T11:00:00Z",
    starred: false,
    bookmarked: false,
    reactions: [],
    meta: { kind: "DRIFT_ANCHOR", title: "Carbon Tax Deep Dive" },
    driftId: "drift-1",
  },
  {
    id: "msg-4",
    text: "I think we need to differentiate between short-term and long-term policy responses.",
    senderId: "user-4",
    senderName: "Thomas Lee",
    createdAt: "2026-03-28T12:30:00Z",
    starred: false,
    bookmarked: false,
    reactions: [
      { emoji: "💡", count: 2, mine: false },
      { emoji: "👀", count: 1, mine: true },
    ],
    facets: [
      {
        id: "facet-4a",
        audience: { kind: "EVERYONE" },
        sharePolicy: "ALLOW" as const,
        body: "I think we need to differentiate between short-term and long-term policy responses.",
        priorityRank: 0,
      },
      {
        id: "facet-4b",
        audience: { kind: "ROLE", roles: ["ADMIN", "MODERATOR"] },
        sharePolicy: "REDACT" as const,
        body: "Confidential: The industry lobbying group has pushed back significantly on the carbon pricing model.",
        priorityRank: 1,
        expiresAt: "2026-06-01T00:00:00Z",
      },
    ],
  },
];

interface MockMessage {
  id: string;
  text: string | null;
  senderId: string;
  senderName: string;
  createdAt: string;
  starred?: boolean;
  bookmarked?: boolean;
  reactions?: { emoji: string; count: number; mine: boolean }[];
  facets?: {
    id: string;
    audience: { kind: string; roles?: string[]; userIds?: string[] };
    sharePolicy: "ALLOW" | "REDACT" | "FORBID";
    body: string;
    priorityRank: number;
    expiresAt?: string | null;
  }[];
  quotes?: { sourceMessageId: string; status: "ok" | "redacted" | "unavailable"; body?: string | null }[];
  linkPreviews?: { urlHash: string; url: string; title?: string | null; desc?: string | null; image?: string | null; status: string }[];
  meta?: { kind: string; title?: string };
  driftId?: string | null;
  edited?: boolean;
  locked?: boolean;
}

const MOCK_DRIFTS = [
  {
    id: "drift-1",
    title: "Carbon Tax Deep Dive",
    kind: "DRIFT" as const,
    isClosed: false,
    isArchived: false,
    messageCount: 14,
    lastMessageAt: "2026-03-29T09:00:00Z",
    anchorMessageId: "msg-3",
    myPrefs: { collapsed: false, pinned: true, muted: false },
  },
  {
    id: "drift-2",
    title: "Renewable Energy Data Sources",
    kind: "DRIFT" as const,
    isClosed: false,
    isArchived: false,
    messageCount: 7,
    lastMessageAt: "2026-03-28T16:00:00Z",
    anchorMessageId: "msg-5",
    myPrefs: { collapsed: false, pinned: false, muted: false },
  },
  {
    id: "thread-1",
    title: "Thread on IPCC findings",
    kind: "THREAD" as const,
    isClosed: false,
    isArchived: false,
    messageCount: 5,
    lastMessageAt: "2026-03-28T11:30:00Z",
    rootMessageId: "msg-1",
    myPrefs: { collapsed: true, pinned: false, muted: true },
  },
];

const MOCK_PROPOSALS = [
  {
    id: "prop-1",
    kind: "FACET" as const,
    facetId: "facet-prop-1",
    authorName: "Alex Chen",
    preview: "Revised: We should implement a graduated carbon tax starting at $25/ton, increasing 5% annually.",
    createdAt: "2026-03-29T10:00:00Z",
    counts: { approve: 3, block: 1 },
  },
  {
    id: "prop-2",
    kind: "FACET" as const,
    facetId: "facet-prop-2",
    authorName: "Maria Garcia",
    preview: "Alternative: A cap-and-trade system with auctioned permits may achieve the same goals with more market flexibility.",
    createdAt: "2026-03-29T11:00:00Z",
    counts: { approve: 1, block: 0 },
  },
];

const MOCK_POLLS = {
  options: {
    id: "poll-1",
    kind: "OPTIONS" as const,
    question: "Which policy approach should we prioritize?",
    options: ["Carbon Tax", "Cap-and-Trade", "Regulation", "Subsidies"],
    totals: [8, 5, 3, 6],
    count: 22,
    myVote: 0,
    anonymous: false,
    closesAt: "2026-04-01T00:00:00Z",
  },
  temp: {
    id: "poll-2",
    kind: "TEMP" as const,
    question: "How confident are you in these projections?",
    avg: 7.2,
    count: 15,
    myValue: 8,
    anonymous: true,
    closesAt: null,
  },
};

const AUDIENCE_TYPES = [
  { kind: "EVERYONE", label: "Everyone", icon: Users, description: "All conversation participants see this layer", color: "bg-green-100 text-green-700 border-green-300" },
  { kind: "ROLE", label: "By Role", icon: Shield, description: "Only users with specific roles (Admin, Moderator, etc.)", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { kind: "LIST", label: "Named List", icon: FileText, description: "A pre-defined list of users", color: "bg-purple-100 text-purple-700 border-purple-300" },
  { kind: "USERS", label: "Specific Users", icon: User, description: "Hand-picked individual recipients", color: "bg-amber-100 text-amber-700 border-amber-300" },
];

const SHARE_POLICIES = [
  { value: "ALLOW", label: "Allow", description: "Layer can be forwarded freely", color: "bg-green-100 text-green-700" },
  { value: "REDACT", label: "Redact", description: "Sensitive content is scrubbed on forward", color: "bg-amber-100 text-amber-700" },
  { value: "FORBID", label: "Forbid", description: "Forwarding is completely blocked", color: "bg-red-100 text-red-700" },
];

const PHASES = [
  {
    id: "foundational",
    title: "Foundational Features",
    description: "Core messaging infrastructure",
    features: [
      {
        id: "conversations",
        title: "Conversations",
        description: "1:1 DMs and group chat rooms",
        icon: MessageSquare,
        status: "complete" as const,
        items: ["Direct messages (1:1)", "Group conversations", "Group creation modal", "Participant management", "Conversation list"],
      },
      {
        id: "realtime",
        title: "Real-time Messaging",
        description: "Supabase broadcast for instant message delivery",
        icon: Send,
        status: "complete" as const,
        items: ["Supabase channel broadcast", "Presence detection", "Optimistic message rendering", "Message normalization"],
      },
      {
        id: "message-layers",
        title: "Message Layers & Permissions",
        description: "One message, multiple audiences — each sees the right content",
        icon: Layers,
        status: "complete" as const,
        items: ["Audience selectors (Everyone, Role, List, Individuals)", "Sharing policies (Allow, Redact, Forbid)", "Priority-ranked layers", "Auto-expiring layers with TTL", "Fine-grained access control engine"],
      },
      {
        id: "composer",
        title: "Message Composer",
        description: "Rich text input with attachments and inline tools",
        icon: Pencil,
        status: "complete" as const,
        items: ["TipTap rich text editor", "File & image attachments", "Drag-and-drop uploads", "Inline poll creation", "Quote insertion"],
      },
      {
        id: "private-chat",
        title: "Private Chat Panes",
        description: "Floating DM windows with persistence",
        icon: MessageCircle,
        status: "complete" as const,
        items: ["PrivateChatManager context", "Draggable pane positions", "Minimize/restore with unread badges", "Session & localStorage persistence", "Anchor messages for context"],
      },
    ],
  },
  {
    id: "phase1",
    title: "Phase 1: Rich Messages",
    description: "Enhanced message interactions and content",
    features: [
      {
        id: "layered-messages",
        title: "Layered Message System",
        description: "Adaptive messages that show different content per audience",
        icon: Layers,
        status: "complete" as const,
        items: ["Audience-aware message bubbles", "Layer switching UI", "Redacted & unavailable states", "Per-layer edit tracking", "Link previews per layer"],
      },
      {
        id: "stars-bookmarks",
        title: "Stars & Bookmarks",
        description: "Mark important messages for quick access",
        icon: Star,
        status: "complete" as const,
        items: ["Star toggle on hover", "Bookmark toggle", "Starred message filter", "Instant optimistic UI updates"],
      },
      {
        id: "reactions",
        title: "Emoji Reactions",
        description: "React to messages with emoji aggregation",
        icon: SmilePlus,
        status: "complete" as const,
        items: ["Aggregated emoji counts with your-vote indicator", "Add/remove reactions instantly", "Reaction bar & picker components", "Efficient batch loading"],
      },
      {
        id: "quoting",
        title: "Quoting & Reply",
        description: "Quote previous messages with jump-to-source",
        icon: Quote,
        status: "complete" as const,
        items: ["Inline quote previews", "Handles redacted & unavailable sources", "Click to jump to original message", "Rich text extraction"],
      },
      {
        id: "link-previews",
        title: "Link Previews",
        description: "Rich OG previews for shared URLs",
        icon: Link2,
        status: "complete" as const,
        items: ["Rich link cards with thumbnails", "Open Graph title, description & image", "Automatic host detection", "Graceful fallback for unfetchable URLs"],
      },
      {
        id: "editing-locking",
        title: "Editing & Locking",
        description: "Edit messages with version tracking and lock protection",
        icon: Lock,
        status: "complete" as const,
        items: ["Edit messages after sending", "\"Edited\" indicator per layer", "Lock messages to prevent changes", "Lock icon indicator in timeline"],
      },
    ],
  },
  {
    id: "phase2",
    title: "Phase 2: Drifts & Threads",
    description: "Branching conversations and threaded discussions",
    features: [
      {
        id: "drifts",
        title: "Drifts",
        description: "Side conversations branching from anchor messages",
        icon: GitBranch,
        status: "complete" as const,
        items: ["Branch from any anchor message", "Dedicated drift conversation pane", "Inline chip indicator in timeline", "Create a drift from any message", "Full message list with composer"],
      },
      {
        id: "threads",
        title: "Threads",
        description: "Rooted reply chains on specific messages",
        icon: MessageCircle,
        status: "complete" as const,
        items: ["Reply chains rooted to a message", "Dedicated thread pane view", "Seamless thread reply flow", "Message count indicators"],
      },
      {
        id: "drift-prefs",
        title: "Drift Member Preferences",
        description: "Per-user drift customization",
        icon: Settings,
        status: "complete" as const,
        items: ["Pin/unpin drifts", "Mute notifications", "Collapse/expand", "Last read tracking", "Per-user preference storage"],
      },
      {
        id: "drift-chips",
        title: "Drift Chips",
        description: "Inline UI elements for drift navigation",
        icon: Hash,
        status: "complete" as const,
        items: ["𒈝 drift icon branding", "Message count display", "Click to open drift pane", "Anchor in message timeline"],
      },
    ],
  },
  {
    id: "phase3",
    title: "Phase 3: Proposals & Polls",
    description: "Collaborative decision-making tools",
    features: [
      {
        id: "proposals",
        title: "Proposals",
        description: "Suggest edits collaboratively with approval workflow",
        icon: Vote,
        status: "complete" as const,
        items: ["Side-by-side proposal comparison", "Approve, request changes, or clear", "Merge accepted edits into the original", "Version history with signed receipts", "Candidate listing with live preview"],
      },
      {
        id: "polls",
        title: "Polls",
        description: "Inline polls with two modes",
        icon: BarChart3,
        status: "complete" as const,
        items: ["Multi-choice voting", "Temperature check (0–10 scale)", "Compact inline poll chip", "Anonymous voting option", "Automatic close-at deadline", "Leading-option highlighting"],
      },
      {
        id: "receipts",
        title: "Read Receipts & Acks",
        description: "Delivery and read confirmation",
        icon: CheckCheck,
        status: "complete" as const,
        items: ["Read receipts per message", "Explicit acknowledgment signals", "Sent → Delivered → Read status", "Efficient batch queries"],
      },
      {
        id: "forwarding",
        title: "Message Forwarding",
        description: "Forward messages with automatic access-control checks",
        icon: Forward,
        status: "complete" as const,
        items: ["Safe-forward with permission checks", "Access control validation before send", "Redact: scrub sensitive content", "Forbid: block forwarding entirely", "Forward to any audience"],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE OVERVIEW COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof PHASES)[0]["features"][0] }) {
  const Icon = feature.icon;

  return (
    <Card className="h-full bg-white/80 backdrop-blur border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sky-100 to-indigo-100 text-sky-700">
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
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Message Layers
// ─────────────────────────────────────────────────────────────────────────────

function SheafFacetDemo() {
  const [selectedAudience, setSelectedAudience] = useState<string>("EVERYONE");
  const [selectedPolicy, setSelectedPolicy] = useState<string>("ALLOW");
  const [activeFacetIdx, setActiveFacetIdx] = useState(0);

  const message = MOCK_MESSAGES[3]; // Thomas Lee's multi-layer message
  const facets = message.facets || [];

  return (
    <Card className="bg-white/90 backdrop-blur border-sky-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Message Layers
          <Badge className="ml-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-xs shadow-sm">Core Feature</Badge>
        </CardTitle>
        <CardDescription>
          A single message can have multiple layers — each visible to a different audience with its own sharing policy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Facet Tabs */}
        <div className="border rounded-lg bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-sm font-medium text-teal-700">
                TL
              </div>
              <div>
                <p className="text-sm font-medium">{message.senderName}</p>
                <p className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {facets.length} layers
            </Badge>
          </div>

          {/* Facet Selector */}
          <div className="flex gap-2">
            {facets.map((f, i) => (
              <button
                key={f.id}
                onClick={() => {
                  setActiveFacetIdx(i);
                  toast.info(`Viewing layer for: ${f.audience.kind}${f.audience.roles ? ` (${f.audience.roles.join(", ")})` : ""}`);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  activeFacetIdx === i
                    ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-200"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                {f.audience.kind === "EVERYONE" ? (
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Everyone</span>
                ) : (
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {f.audience.roles?.join(", ")}</span>
                )}
              </button>
            ))}
          </div>

          {/* Active Facet Content */}
          {facets[activeFacetIdx] && (
            <div className="rounded-lg border p-3 bg-slate-50">
              <p className="text-sm">{facets[activeFacetIdx].body}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span className={`px-2 py-0.5 rounded-full ${
                  facets[activeFacetIdx].sharePolicy === "ALLOW" ? "bg-green-100 text-green-700" :
                  facets[activeFacetIdx].sharePolicy === "REDACT" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {facets[activeFacetIdx].sharePolicy}
                </span>
                {facets[activeFacetIdx].expiresAt && (
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    Expires {new Date(facets[activeFacetIdx].expiresAt!).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Audience Type Reference */}
        <div>
          <p className="text-sm font-medium mb-2">Audience Types:</p>
          <div className="grid grid-cols-2 gap-2">
            {AUDIENCE_TYPES.map((at) => {
              const Icon = at.icon;
              const isSelected = selectedAudience === at.kind;
              return (
                <button
                  key={at.kind}
                  onClick={() => {
                    setSelectedAudience(at.kind);
                    toast.success(`Selected audience: ${at.label}`);
                  }}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 ${isSelected ? "text-sky-600" : "text-slate-500"}`} />
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? "text-sky-700" : ""}`}>{at.label}</p>
                    <p className="text-xs text-muted-foreground">{at.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Share Policy Reference */}
        <div>
          <p className="text-sm font-medium mb-2">Share Policies:</p>
          <div className="flex gap-2">
            {SHARE_POLICIES.map((sp) => (
              <button
                key={sp.value}
                onClick={() => {
                  setSelectedPolicy(sp.value);
                  toast.info(`Policy: ${sp.label} — ${sp.description}`);
                }}
                className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                  selectedPolicy === sp.value
                    ? "border-sky-500 ring-2 ring-sky-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className={`text-sm font-medium ${sp.color} inline-block px-2 py-0.5 rounded-full`}>{sp.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{sp.description}</p>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Message Timeline
// ─────────────────────────────────────────────────────────────────────────────

function MessageTimelineDemo() {
  const [starredMessages, setStarredMessages] = useState<Set<string>>(new Set(["msg-1"]));
  const [bookmarkedMessages, setBookmarkedMessages] = useState<Set<string>>(new Set(["msg-2"]));
  const [messageReactions, setMessageReactions] = useState<Record<string, { emoji: string; count: number; mine: boolean }[]>>(
    Object.fromEntries(MOCK_MESSAGES.map((m) => [m.id, m.reactions || []]))
  );

  const toggleStar = (msgId: string) => {
    setStarredMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
        toast.info("Unstarred");
      } else {
        next.add(msgId);
        toast.success("Starred");
      }
      return next;
    });
  };

  const toggleBookmark = (msgId: string) => {
    setBookmarkedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
        toast.info("Bookmark removed");
      } else {
        next.add(msgId);
        toast.success("Bookmarked");
      }
      return next;
    });
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessageReactions((prev) => {
      const existing = prev[msgId] || [];
      const idx = existing.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        const updated = [...existing];
        if (updated[idx].mine) {
          updated[idx] = { ...updated[idx], count: updated[idx].count - 1, mine: false };
          if (updated[idx].count <= 0) updated.splice(idx, 1);
        } else {
          updated[idx] = { ...updated[idx], count: updated[idx].count + 1, mine: true };
        }
        return { ...prev, [msgId]: updated };
      }
      return { ...prev, [msgId]: [...existing, { emoji, count: 1, mine: true }] };
    });
    toast.success(`Reacted with ${emoji}`);
  };

  const quickEmojis = ["👍", "❤️", "🔥", "💡", "👀", "🙏"];

  return (
    <Card className="bg-white/90 backdrop-blur border-blue-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Message Timeline
          <Badge className="ml-2 bg-gradient-to-r from-blue-500 to-sky-500 text-white text-xs shadow-sm">Interactive</Badge>
        </CardTitle>
        <CardDescription>
          Stars, bookmarks, reactions, quotes, link previews, and drift anchors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {MOCK_MESSAGES.map((msg) => {
          const isStarred = starredMessages.has(msg.id);
          const isBookmarked = bookmarkedMessages.has(msg.id);
          const reactions = messageReactions[msg.id] || [];
          const isDriftAnchor = msg.meta?.kind === "DRIFT_ANCHOR";

          return (
            <div
              key={msg.id}
              className="group rounded-lg border bg-white p-3 hover:shadow-sm transition-shadow"
              data-msg-id={msg.id}
            >
              {/* Drift Anchor Chip */}
              {isDriftAnchor && (
                <div className="mx-auto my-2">
                  <button
                    onClick={() => toast.info(`Opening drift: ${msg.meta?.title}`)}
                    className="w-full justify-center items-center text-center text-sm py-3 px-3 rounded-xl bg-white/40 border border-purple-200 hover:bg-purple-50 transition-colors"
                  >
                    <span>𒈝</span>
                    <span className="ml-2 font-medium">{msg.meta?.title}</span>
                    <span className="ml-2 text-slate-500">· 14 messages</span>
                  </button>
                </div>
              )}

              {/* Regular Message */}
              {!isDriftAnchor && (
                <>
                  {/* Quote Block */}
                  {msg.quotes?.map((q, qi) => (
                    <div key={qi} className="rounded-md border-l-4 border-sky-300 bg-sky-50/50 px-3 py-2 mb-2 text-sm text-slate-600 cursor-pointer hover:bg-sky-50" onClick={() => toast.info("Jump to quoted message")}>
                      <span className="text-xs text-slate-400">Replying to:</span>
                      <p className="mt-0.5">{typeof q.body === "string" ? q.body : "(content)"}</p>
                    </div>
                  ))}

                  {/* Message Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                        {msg.senderName.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span className="text-sm font-medium">{msg.senderName}</span>
                      <span className="text-xs text-slate-400">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      {msg.edited && <Badge variant="outline" className="text-xs px-1">edited</Badge>}
                      {msg.locked && <Lock className="w-3 h-3 text-amber-500" />}
                    </div>

                    {/* Action buttons (visible on hover) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleStar(msg.id)}
                            className={`p-1 rounded hover:bg-slate-100 ${isStarred ? "text-yellow-500" : "text-slate-400"}`}
                          >
                            <Star className="w-4 h-4" fill={isStarred ? "currentColor" : "none"} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{isStarred ? "Unstar" : "Star"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleBookmark(msg.id)}
                            className={`p-1 rounded hover:bg-slate-100 ${isBookmarked ? "text-blue-500" : "text-slate-400"}`}
                          >
                            <Bookmark className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{isBookmarked ? "Remove bookmark" : "Bookmark"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => toast.info("Quote this message")} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                            <Quote className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Quote</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => toast.info("Start a thread")} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Thread</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => toast.info("Create a drift")} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                            <GitBranch className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Start Drift</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Message Body */}
                  <p className="text-sm mt-1.5 ml-9">{msg.text}</p>

                  {/* Link Preview */}
                  {msg.linkPreviews?.map((lp) => (
                    <div key={lp.urlHash} className="ml-9 mt-2 rounded-xl border bg-white max-w-[60%] px-3 py-3">
                      <div className="text-xs text-slate-500">
                        {(() => { try { return new URL(lp.url).host; } catch { return ""; } })()}
                      </div>
                      {lp.title && <div className="font-medium text-sm">{lp.title}</div>}
                      {lp.desc && <div className="text-sm text-slate-600 mt-1 line-clamp-3">{lp.desc}</div>}
                    </div>
                  ))}

                  {/* Reactions */}
                  {reactions.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 ml-9">
                      {reactions.map((r, ri) => (
                        <button
                          key={ri}
                          onClick={() => addReaction(msg.id, r.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                            r.mine ? "bg-sky-100 border-sky-300 text-sky-700" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span>{r.count}</span>
                        </button>
                      ))}
                      {/* Quick add reaction */}
                      <div className="relative group/react">
                        <button className="p-1 rounded-full hover:bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <SmilePlus className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-full left-0 mb-1 hidden group-hover/react:flex gap-0.5 bg-white border rounded-lg shadow-lg p-1 z-10">
                          {quickEmojis.map((e) => (
                            <button key={e} onClick={() => addReaction(msg.id, e)} className="p-1 hover:bg-slate-100 rounded text-sm">
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Composer Preview */}
        <div className="rounded-lg border bg-white p-3 mt-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50">
              <Pencil className="w-4 h-4" />
              <span>Type a message...</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><Paperclip className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><ImageIcon className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent>Add image</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><BarChart3 className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent>Create poll</TooltipContent>
            </Tooltip>
            <Button size="sm" className="bg-sky-600 hover:bg-sky-700" onClick={() => toast.success("Message sent!")}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Drifts & Threads
// ─────────────────────────────────────────────────────────────────────────────

function DriftsAndThreadsDemo() {
  const [selectedDrift, setSelectedDrift] = useState<string | null>(null);
  const [driftPrefs, setDriftPrefs] = useState<Record<string, { pinned: boolean; muted: boolean; collapsed: boolean }>>(
    Object.fromEntries(MOCK_DRIFTS.map((d) => [d.id, d.myPrefs]))
  );

  const drift = MOCK_DRIFTS.find((d) => d.id === selectedDrift);

  const togglePref = (driftId: string, key: "pinned" | "muted" | "collapsed") => {
    setDriftPrefs((prev) => ({
      ...prev,
      [driftId]: { ...prev[driftId], [key]: !prev[driftId][key] },
    }));
    toast.success(`${key.charAt(0).toUpperCase() + key.slice(1)} ${driftPrefs[driftId][key] ? "off" : "on"}`);
  };

  return (
    <Card className="bg-white/90 backdrop-blur border-purple-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Drifts & Threads
          <Badge className="ml-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white text-xs shadow-sm">Phase 2</Badge>
        </CardTitle>
        <CardDescription>
          Side conversations (Drifts) and reply chains (Threads) with per-user preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drift/Thread List */}
        <div className="space-y-2">
          {MOCK_DRIFTS.map((d) => {
            const isSelected = selectedDrift === d.id;
            const prefs = driftPrefs[d.id];
            return (
              <div key={d.id}>
                <button
                  onClick={() => setSelectedDrift(isSelected ? null : d.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                      : "bg-white hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {d.kind === "DRIFT" ? (
                      <GitBranch className="w-5 h-5 text-purple-500" />
                    ) : (
                      <MessageCircle className="w-5 h-5 text-sky-500" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{d.title}</p>
                        <Badge variant="outline" className="text-xs">{d.kind}</Badge>
                        {prefs.pinned && <Pin className="w-3 h-3 text-amber-500" />}
                        {prefs.muted && <BellOff className="w-3 h-3 text-slate-400" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {d.messageCount} messages · Last active {new Date(d.lastMessageAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                </button>

                {/* Expanded Drift Detail */}
                {isSelected && (
                  <div className="mt-2 ml-8 p-3 bg-white border rounded-lg space-y-3">
                    {/* Preferences */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={prefs.pinned ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => togglePref(d.id, "pinned")}
                      >
                        <Pin className="w-3 h-3 mr-1" />
                        {prefs.pinned ? "Pinned" : "Pin"}
                      </Button>
                      <Button
                        size="sm"
                        variant={prefs.muted ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => togglePref(d.id, "muted")}
                      >
                        <BellOff className="w-3 h-3 mr-1" />
                        {prefs.muted ? "Muted" : "Mute"}
                      </Button>
                      <Button
                        size="sm"
                        variant={prefs.collapsed ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => togglePref(d.id, "collapsed")}
                      >
                        <ChevronDown className="w-3 h-3 mr-1" />
                        {prefs.collapsed ? "Collapsed" : "Collapse"}
                      </Button>
                    </div>

                    {/* Simulated drift messages */}
                    <div className="border rounded-lg p-3 bg-slate-50 space-y-2 max-h-48 overflow-y-auto">
                      <div className="text-xs text-slate-400 text-center mb-2">— {d.title} —</div>
                      {[
                        { sender: "Maria Garcia", text: "Let me start with the carbon pricing model from the EU ETS." },
                        { sender: "Alex Chen", text: "Good reference. How does it compare to the Canadian backstop?" },
                        { sender: "Dr. Jane Smith", text: "The key difference is in the revenue recycling mechanism." },
                      ].map((dm, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs flex-shrink-0">
                            {dm.sender.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div>
                            <span className="text-xs font-medium">{dm.sender}</span>
                            <p className="text-xs text-slate-600">{dm.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Drift Chip Preview */}
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Inline chip (as it appears in the timeline):</p>
                      <div className="inline-block rounded-xl border border-purple-200 bg-white/40 px-3 py-2 text-sm">
                        𒈝 <span className="font-medium">{d.title}</span>
                        <span className="ml-2 text-slate-500">· {d.messageCount} messages</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Proposals
// ─────────────────────────────────────────────────────────────────────────────

function ProposalsDemo() {
  const [proposalCounts, setProposalCounts] = useState<Record<string, { approve: number; block: number }>>(
    Object.fromEntries(MOCK_PROPOSALS.map((p) => [p.facetId, p.counts]))
  );
  const [mergedId, setMergedId] = useState<string | null>(null);

  const signal = (facetId: string, kind: "APPROVE" | "BLOCK") => {
    setProposalCounts((prev) => ({
      ...prev,
      [facetId]: {
        ...prev[facetId],
        approve: kind === "APPROVE" ? prev[facetId].approve + 1 : prev[facetId].approve,
        block: kind === "BLOCK" ? prev[facetId].block + 1 : prev[facetId].block,
      },
    }));
    toast.success(`${kind === "APPROVE" ? "Approved" : "Requested changes on"} proposal`);
  };

  return (
    <Card className="bg-white/90 backdrop-blur border-emerald-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Vote className="w-5 h-5" />
          Proposals
          <Badge className="ml-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs shadow-sm">Phase 3</Badge>
        </CardTitle>
        <CardDescription>
          Suggested edits with collaborative approve / request-changes / merge workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Original message */}
        <div className="rounded-lg border p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs">JS</div>
            <span className="text-sm font-medium">Dr. Jane Smith</span>
            <Badge variant="outline" className="text-xs">Original</Badge>
          </div>
          <p className="text-sm">We should implement a carbon tax to address climate change effectively.</p>
        </div>

        {/* Proposals */}
        <div className="space-y-2">
          {MOCK_PROPOSALS.map((p) => {
            const counts = proposalCounts[p.facetId];
            const isMerged = mergedId === p.facetId;
            return (
              <div key={p.id} className={`rounded-lg border p-3 ${isMerged ? "bg-emerald-50 border-emerald-300" : "bg-slate-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.authorName}</span>
                    <Badge variant="outline" className="text-xs">Proposal</Badge>
                    {isMerged && <Badge className="bg-emerald-600 text-xs">Merged</Badge>}
                  </div>
                  <span className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm mb-2">{p.preview}</p>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    ✅ {counts.approve} · ⛔ {counts.block}
                  </div>
                  {!isMerged && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => signal(p.facetId, "APPROVE")}>
                        <ThumbsUp className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => signal(p.facetId, "BLOCK")}>
                        <ThumbsDown className="w-3 h-3 mr-1" /> Request changes
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          setMergedId(p.facetId);
                          toast.success("Proposal merged! Original message updated.");
                        }}
                      >
                        <Merge className="w-3 h-3 mr-1" /> Merge
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-500">
          Tip: Merging updates the original message. Receipts keep a signed history (vN).
        </p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Polls
// ─────────────────────────────────────────────────────────────────────────────

function PollsDemo() {
  const [optionsPoll, setOptionsPoll] = useState(MOCK_POLLS.options);
  const [tempPoll, setTempPoll] = useState(MOCK_POLLS.temp);

  const voteOption = (idx: number) => {
    setOptionsPoll((prev) => {
      const totals = [...prev.totals];
      if (prev.myVote !== null) totals[prev.myVote]--;
      totals[idx]++;
      return { ...prev, totals, myVote: idx, count: prev.count + (prev.myVote === null ? 1 : 0) };
    });
    toast.success(`Voted for: ${optionsPoll.options[idx]}`);
  };

  const voteTemp = (value: number) => {
    setTempPoll((prev) => ({
      ...prev,
      myValue: value,
      avg: Math.round(((prev.avg * prev.count + value) / (prev.count + 1)) * 10) / 10,
      count: prev.count + (prev.myValue === null ? 1 : 0),
    }));
    toast.success(`Temperature vote: ${value}/10`);
  };

  const totalVotes = optionsPoll.totals.reduce((a, b) => a + b, 0);
  const maxVote = Math.max(...optionsPoll.totals);

  return (
    <Card className="bg-white/90 backdrop-blur border-emerald-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Inline Polls
          <Badge className="ml-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs shadow-sm">Phase 3</Badge>
        </CardTitle>
        <CardDescription>
          OPTIONS (multi-choice) and TEMP (temperature check) poll types
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* OPTIONS Poll */}
        <div className="border rounded-lg bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{optionsPoll.question}</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">OPTIONS</Badge>
              {optionsPoll.closesAt && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  Closes {new Date(optionsPoll.closesAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {optionsPoll.options.map((opt, idx) => {
              const count = optionsPoll.totals[idx];
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isMyVote = optionsPoll.myVote === idx;
              const isLeading = count === maxVote && maxVote > 0;

              return (
                <button
                  key={idx}
                  onClick={() => voteOption(idx)}
                  className={`w-full relative p-2.5 rounded-lg border text-left transition-all overflow-hidden ${
                    isMyVote
                      ? "border-sky-500 ring-2 ring-sky-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Background bar */}
                  <div
                    className={`absolute inset-y-0 left-0 ${isLeading ? "bg-sky-100" : "bg-slate-100"} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isMyVote && <Check className="w-3.5 h-3.5 text-sky-600" />}
                      <span className="text-sm font-medium">{opt}</span>
                      {isLeading && <Sparkles className="w-3 h-3 text-amber-500" />}
                    </div>
                    <span className="text-xs text-slate-600">{pct}% ({count})</span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 text-center">{optionsPoll.count} votes total</p>
        </div>

        {/* TEMP Poll */}
        <div className="border rounded-lg bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{tempPoll.question}</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">TEMP</Badge>
              {tempPoll.anonymous && <Badge variant="outline" className="text-xs">Anonymous</Badge>}
            </div>
          </div>

          <div className="space-y-2">
            {/* Temperature scale */}
            <div className="flex gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => voteTemp(i)}
                  className={`flex-1 py-2 rounded text-xs font-medium transition-all ${
                    tempPoll.myValue === i
                      ? "bg-sky-600 text-white ring-2 ring-sky-300"
                      : i <= (tempPoll.avg ?? 0)
                      ? "bg-sky-100 hover:bg-sky-200 text-sky-700"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>

            {/* Average indicator */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Average: <span className="font-semibold text-sky-700">{tempPoll.avg}</span>/10</span>
              <span className="text-slate-500">{tempPoll.count} responses</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Private Chat Panes
// ─────────────────────────────────────────────────────────────────────────────

function PrivateChatDemo() {
  const [panes, setPanes] = useState([
    { id: "dm:user-2", peerId: "user-2", peerName: "Alex Chen", minimised: false, unread: 0 },
    { id: "dm:user-3", peerId: "user-3", peerName: "Maria Garcia", minimised: true, unread: 3 },
  ]);

  const toggleMinimise = (id: string) => {
    setPanes((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, minimised: !p.minimised, unread: p.minimised ? 0 : p.unread } : p
      )
    );
  };

  const closePane = (id: string) => {
    setPanes((prev) => prev.filter((p) => p.id !== id));
    toast.info("Chat pane closed");
  };

  const openNewPane = () => {
    const newId = `dm:user-4`;
    if (panes.find((p) => p.id === newId)) {
      toast.info("Pane already open");
      return;
    }
    setPanes((prev) => [...prev, { id: newId, peerId: "user-4", peerName: "Thomas Lee", minimised: false, unread: 0 }]);
    toast.success("New DM pane opened");
  };

  return (
    <Card className="bg-white/90 backdrop-blur border-sky-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Private Chat Panes
          <Badge className="ml-2 bg-gradient-to-r from-sky-500 to-blue-500 text-white text-xs shadow-sm">Foundational</Badge>
        </CardTitle>
        <CardDescription>
          Floating DM windows with minimize/restore, unread badges, and persistence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Button size="sm" variant="outline" onClick={openNewPane}>
            <PlusCircle className="w-3 h-3 mr-1" /> Open DM with Thomas Lee
          </Button>
        </div>

        <div className="flex flex-wrap gap-4">
          {panes.map((pane) => (
            <div
              key={pane.id}
              className={`border rounded-lg transition-all ${
                pane.minimised ? "w-48" : "w-72"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-2 bg-sky-600 text-white rounded-t-lg cursor-pointer" onClick={() => toggleMinimise(pane.id)}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-sky-400 flex items-center justify-center text-xs">
                    {pane.peerName.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span className="text-sm font-medium">{pane.peerName}</span>
                  {pane.unread > 0 && (
                    <Badge className="bg-red-500 text-white text-xs h-5 min-w-5 flex items-center justify-center">
                      {pane.unread}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); toggleMinimise(pane.id); }} className="p-0.5 hover:bg-sky-500 rounded">
                    <ChevronDown className={`w-4 h-4 transition-transform ${pane.minimised ? "rotate-180" : ""}`} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); closePane(pane.id); }} className="p-0.5 hover:bg-sky-500 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              {!pane.minimised && (
                <div className="p-3 bg-white rounded-b-lg space-y-2">
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-lg px-3 py-1.5 text-xs max-w-[80%]">
                        Hey, did you see the latest data?
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-sky-100 rounded-lg px-3 py-1.5 text-xs max-w-[80%]">
                        Yes! The tipping point analysis is fascinating.
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-lg px-3 py-1.5 text-xs max-w-[80%]">
                        Let me pull up the relevant section...
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 border-t pt-2">
                    <input
                      className="flex-1 text-xs px-2 py-1 border rounded"
                      placeholder="Type a message..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          toast.success("Message sent to " + pane.peerName);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                    <button className="p-1 text-sky-600 hover:bg-sky-50 rounded" onClick={() => toast.success("Message sent!")}>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Forwarding with ACL
// ─────────────────────────────────────────────────────────────────────────────

function ForwardingDemo() {
  const [forwardResult, setForwardResult] = useState<string | null>(null);

  const scenarios = [
    {
      policy: "ALLOW",
      label: "Forward Allowed",
      description: "Message forwarded as-is to the new audience",
      color: "bg-green-100 border-green-300",
      resultIcon: Check,
      resultColor: "text-green-600",
    },
    {
      policy: "REDACT",
      label: "Forward (Redacted)",
      description: "Sensitive content scrubbed, structure preserved",
      color: "bg-amber-100 border-amber-300",
      resultIcon: EyeOff,
      resultColor: "text-amber-600",
    },
    {
      policy: "FORBID",
      label: "Forward Blocked",
      description: "Forwarding completely prevented by access controls",
      color: "bg-red-100 border-red-300",
      resultIcon: X,
      resultColor: "text-red-600",
    },
  ];

  return (
    <Card className="bg-white/90 backdrop-blur border-amber-200/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Forward className="w-5 h-5" />
          Message Forwarding & Access Controls
          <Badge className="ml-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs shadow-sm">Phase 3</Badge>
        </CardTitle>
        <CardDescription>
          Forwarding respects sharing policies — messages are checked against access controls before delivery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source message */}
        <div className="rounded-lg border p-3 bg-white">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs">TL</div>
            <span className="text-sm font-medium">Thomas Lee</span>
          </div>
          <p className="text-sm">Confidential: The industry lobbying group has pushed back significantly.</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">REDACT policy</Badge>
            <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">ROLE: ADMIN, MODERATOR</Badge>
          </div>
        </div>

        {/* Forward scenarios */}
        <div className="grid grid-cols-3 gap-3">
          {scenarios.map((s) => {
            const ResIcon = s.resultIcon;
            const isActive = forwardResult === s.policy;
            return (
              <button
                key={s.policy}
                onClick={() => {
                  setForwardResult(s.policy);
                  if (s.policy === "FORBID") {
                    toast.error("Forwarding blocked by access controls");
                  } else if (s.policy === "REDACT") {
                    toast.info("Forwarded with redacted content");
                  } else {
                    toast.success("Message forwarded successfully");
                  }
                }}
                className={`p-3 rounded-lg border text-left transition-all ${s.color} ${
                  isActive ? "ring-2 ring-sky-300" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ResIcon className={`w-4 h-4 ${s.resultColor}`} />
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                <p className="text-xs text-slate-600">{s.description}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MessagingFeaturesPage() {
  return (
    <TooltipProvider>
      <div className="min-h-screen w-full bg-[#fef9f7] relative">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 80%, rgba(255, 160, 146, 0.25) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(255, 244, 228, 0.3) 0%, transparent 50%),
              radial-gradient(circle at 40% 40%, rgba(255, 160, 146, 0.15) 0%, transparent 50%)`,
          }}
        />
        <Toaster position="bottom-right" richColors />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-10 space-y-10">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-4 px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-600/10 via-indigo-500/10 to-purple-600/10">
                <MessageSquare className="p-2 rounded-xl  w-10 h-10 btnv2" />
              <h1 className="text-2xl  font-regular px-5 tracking-wide bg-clip-text text-black bg-gradient-to-r from-sky-100 via-indigo-100 to-purple-100 btnv2">
                Messaging Features
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Comprehensive demonstration of Isonomia&apos;s messaging system — Message Layers, Drifts,
              Proposals, Polls, and real-time collaboration features.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge className="bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200 text-sm">Foundational</Badge>
              <Badge className="bg-indigo-100 text-blue-700 border border-blue-200 hover:bg-blue-200 text-sm">Phase 1: Rich Messages</Badge>
              <Badge className="bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 text-sm">Phase 2: Drifts & Threads</Badge>
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 text-sm">Phase 3: Proposals & Polls</Badge>
            </div>
          </div>

          {/* Tabbed Layout */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-12 bg-white/80 backdrop-blur border shadow-sm">
              <TabsTrigger value="overview" className="text-sm data-[state=active]:bg-sky-50 data-[state=active]:text-sky-700">Overview</TabsTrigger>
              <TabsTrigger value="sheaf" className="text-sm data-[state=active]:bg-sky-50 data-[state=active]:text-sky-700">Layers & Messages</TabsTrigger>
              <TabsTrigger value="drifts" className="text-sm data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">Drifts & Threads</TabsTrigger>
              <TabsTrigger value="proposals" className="text-sm data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Proposals & Polls</TabsTrigger>
              <TabsTrigger value="implementation" className="text-sm data-[state=active]:bg-slate-100 data-[state=active]:text-slate-700">Implementation</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-8">
              {PHASES.map((phase) => (
                <div key={phase.id} className="space-y-4">
                  <div className="rounded-xl border bg-gradient-to-r from-slate-50 to-white p-5 shadow-sm">
                    <h3 className="font-semibold text-lg tracking-tight">{phase.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{phase.description}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {phase.features.map((feature) => (
                      <FeatureCard key={feature.id} feature={feature} />
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Sheaf & Messages Tab */}
            <TabsContent value="sheaf" className="space-y-6">
              <div className="rounded-xl border bg-gradient-to-r from-sky-50/80 to-white p-5 shadow-sm">
                <h3 className="font-semibold text-lg tracking-tight">Message Layers & Rich Messages <Badge variant="outline" className="ml-2">Core + Phase 1</Badge></h3>
                <p className="text-sm text-muted-foreground mt-1">Multi-audience messaging with access-controlled visibility, starring, reactions, quoting, and link previews.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SheafFacetDemo />
                <MessageTimelineDemo />
              </div>
            </TabsContent>

            {/* Drifts & Threads Tab */}
            <TabsContent value="drifts" className="space-y-6">
              <div className="rounded-xl border bg-gradient-to-r from-purple-50/80 to-white p-5 shadow-sm">
                <h3 className="font-semibold text-lg tracking-tight">Drifts & Threads <Badge variant="outline" className="ml-2">Phase 2</Badge></h3>
                <p className="text-sm text-muted-foreground mt-1">Side conversations branching from anchors (Drifts) and reply chains (Threads) with per-user preferences.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DriftsAndThreadsDemo />
                <PrivateChatDemo />
              </div>
            </TabsContent>

            {/* Proposals & Polls Tab */}
            <TabsContent value="proposals" className="space-y-6">
              <div className="rounded-xl border bg-gradient-to-r from-emerald-50/80 to-white p-5 shadow-sm">
                <h3 className="font-semibold text-lg tracking-tight">Proposals & Polls <Badge variant="outline" className="ml-2">Phase 3</Badge></h3>
                <p className="text-sm text-muted-foreground mt-1">Collaborative decision-making: candidate proposals with approval workflows, and inline polls with two voting modes.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProposalsDemo />
                <PollsDemo />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ForwardingDemo />

                {/* Read Receipts & Acks Info Card */}
                <Card className="bg-white/90 backdrop-blur border-emerald-200/60 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCheck className="w-5 h-5" />
                      Read Receipts & Acknowledgments
                      <Badge className="ml-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs shadow-sm">Phase 3</Badge>
                    </CardTitle>
                    <CardDescription>
                      Delivery confirmation and explicit acknowledgment signals
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {[
                        { label: "Sent", icon: "✉️", desc: "Message delivered to server", status: "bg-slate-100 text-slate-700" },
                        { label: "Delivered", icon: "📬", desc: "Broadcast received by recipient", status: "bg-blue-100 text-blue-700" },
                        { label: "Read", icon: "👁️", desc: "Recipient viewed the message", status: "bg-green-100 text-green-700" },
                        { label: "Acknowledged", icon: "✅", desc: "Explicit ack from recipient (API)", status: "bg-emerald-100 text-emerald-700" },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center gap-3 p-2 rounded-lg border bg-white">
                          <span className="text-lg">{s.icon}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{s.label}</p>
                            <p className="text-xs text-slate-500">{s.desc}</p>
                          </div>
                          <Badge className={`${s.status} text-xs`}>{s.label}</Badge>
                        </div>
                      ))}
                    </div>
                    <div className="border rounded-lg p-3 bg-white text-xs text-slate-600">
                      <p><strong>API Endpoints:</strong></p>
                      <ul className="mt-1 space-y-0.5 font-mono">
                        <li>POST /api/messages/[id]/receipts — Read receipt</li>
                        <li>POST /api/messages/[id]/ack — Explicit acknowledgment</li>
                        <li>POST /api/messages/[id]/star — Star toggle</li>
                        <li>POST /api/messages/[id]/bookmark — Bookmark toggle</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Implementation Tab */}
            <TabsContent value="implementation" className="space-y-6">
              {/* Architecture Overview */}
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Messaging Architecture Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-sky-300">Core Components</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/ChatRoom.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/MessageComposer.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/ConversationList.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/ConversationView.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/MessageListVirtual.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/MessengerPane.tsx</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-sky-300">Layers & Access Controls</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/sheaf/SheafMessageBubble.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> packages/sheaf-acl/ (@app/sheaf-acl)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/sheaf/messages/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/sheaf/forward-check/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/sheaf/upload/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> hooks/useSafeForward.ts</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-sky-300">State & Realtime</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> contexts/useChatStore.ts (Zustand)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> contexts/PrivateChatManager.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/MessagesRealtimeBootstrap.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> lib/realtime/broadcast.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> hooks/useStars.ts</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    Drifts, Proposals & Polls Implementation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-purple-300">Drifts & Threads</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/DriftPane.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/DriftChip.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/drifts/route.ts (create)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/drifts/list/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/drifts/[id]/messages/route.ts</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-emerald-300">Proposals</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/proposals/ProposalsCompareModal.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/proposals/signal/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/proposals/merge/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/proposals/candidates/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/proposals/list/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/proposals/ensure/route.ts</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-amber-300">Polls & Message APIs</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/PollChip.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/QuickPollModal.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/polls/route.ts (create)</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/polls/[id]/vote/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/polls/query/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/reactions/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/messages/[id]/star/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/messages/[id]/bookmark/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/messages/[id]/lock/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/messages/[id]/ack/route.ts</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> app/api/messages/[id]/receipts/route.ts</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      <strong className="text-slate-300">Architecture:</strong>{" "}
                      Zustand store (<code className="bg-slate-700 px-1 rounded">useChatStore</code>) for message state •
                      Supabase realtime broadcast for live delivery •
                      PrivateChatManager context with useReducer for DM panes •
                      @app/sheaf-acl package for audience resolution and forward checks •
                      Drift/Thread as Prisma models with anchor/root message references
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Additional UI Components Reference */}
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Rich Message Components
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <p className="font-semibold mb-2 text-sky-300">Message UI</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/StarToggle.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/StarredFilterToggle.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/QuoteBlock.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/LinkCard.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/MessageActions.tsx</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-sky-300">Chat Management</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/GroupCreationModal.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/ConversationHeader.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/MessageUserModal.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/PrivateChatDock.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/PrivateChatShell.tsx</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2 text-sky-300">Poll Components</p>
                      <ul className="space-y-1 text-slate-300 font-mono text-xs">
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/PollChip.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/QuickPollModal.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/QuickPollComposer.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> components/chat/QuickTempModal.tsx</li>
                        <li className="flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> types/poll.ts</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="text-center text-sm text-slate-400 pb-10 pt-4 border-t border-slate-200/60">
            <p>Messaging Features Demo • Foundational + Phase 1–3 Complete • Isonomia Platform</p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
