"use client";

/**
 * Social Features Demo Page
 *
 * Interactive demonstration of the core social media aspects of the forum:
 *
 * SECTION 1 — FEED & POSTS:
 * - 1.1 Feed (RealtimeFeed, infinite scroll, post filtering)
 * - 1.2 Post Types (TEXT, IMAGE, VIDEO, GALLERY, ARTICLE, MUSIC, PREDICTION, PRODUCT_REVIEW, etc.)
 * - 1.3 Post Actions (likes, comments, repost, share, expiration timer, delete)
 *
 * SECTION 2 — PROFILES & SOCIAL:
 * - 2.1 Profile (ProfileHeader, tabs, user attributes, customization)
 * - 2.2 Friends & Following (mutual follow = friends, follow button, suggestions)
 * - 2.3 Notifications (follow, message, trade, market resolved)
 *
 * SECTION 3 — MESSAGING:
 * - 3.1 Conversations (DMs, group chats, conversation list)
 * - 3.2 Chat (messages, attachments, polls, drifts, quoting, starring)
 *
 * SECTION 4 — ROOMS & SPACES:
 * - 4.1 Rooms (spatial canvas, realtime posts with x/y, edges)
 * - 4.2 Stacks (curated post collections, collaborators, discussions)
 *
 * Accessible at: /test/social-features
 */

import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  MessageSquare,
  Heart,
  Share2,
  Repeat2,
  Image,
  Video,
  Music,
  FileText,
  Type,
  LayoutGrid,
  Star,
  TrendingUp,
  ShoppingBag,
  Users,
  UserPlus,
  UserCheck,
  Bell,
  Send,
  Paperclip,
  BarChart3,
  Quote,
  Search,
  MapPin,
  Calendar,
  BookOpen,
  Layers,
  PlusCircle,
  MessageCircle,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Check,
  Eye,
  Clock,
  Trash2,
  Globe,
  Lock,
  Sparkles,
  Hash,
  Bookmark,
  Filter,
  ThumbsDown,
  Play,
  Code,
  Palette,
  Zap,
  ArrowRight,
  MoreHorizontal,
  LinkIcon,
  ExternalLink,
  CircleDot,
  Rss,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_USERS = [
  { id: "user-1", name: "Rimbaud", username: "rimbaud", image: null, bio: "Walking, light, the Zibaldone", interests: ["Literature", "Philosophy", "Walking"], location: "San Francisco, CA" },
  { id: "user-2", name: "Simonides", username: "simonides", image: null, bio: "Photographs, objects, the weight of cloth", interests: ["Photography", "Design", "Skating"], location: "New York, NY" },
  { id: "user-3", name: "Varda", username: "varda", image: null, bio: "Sound, film, the body in the room", interests: ["Music", "Sound", "Film"], location: "Los Angeles, CA" },
  { id: "user-4", name: "Electra", username: "electra", image: null, bio: "Political philosophy, psychoanalysis, formal systems", interests: ["Philosophy", "Psychoanalysis", "Political Theory"], location: "London, UK" },
  { id: "user-5", name: "Pyrrho", username: "pyrrho", image: null, bio: "Probability, epistemology, market structure", interests: ["Epistemology", "Markets", "Risk"], location: "Berlin, DE" },
];

interface MockPost {
  id: string;
  author: typeof MOCK_USERS[0];
  type: string;
  content: string;
  image_url?: string;
  video_url?: string;
  caption?: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  expirationDate?: string;
  productReview?: { product_name: string; rating: number; summary: string };
  predictionMarket?: { question: string; yesPrice: number; volume: number };
  libraryTitle?: string;
  libraryItems?: string[];
}

const MOCK_POSTS: MockPost[] = [
  {
    id: "post-1",
    author: MOCK_USERS[0],
    type: "TEXT",
    content: "Walked from the park through Chinatown to North Beach. The light on the fire escapes at 4pm does something the light at noon does not do. Related: the last paragraph of the Leopardi essay on the Zibaldone — the one about the specific quality of afternoon shadows in small towns.",
    likeCount: 3,
    commentCount: 1,
    createdAt: "2026-04-14T09:30:00Z",
  },
  {
    id: "post-2",
    author: MOCK_USERS[1],
    type: "IMAGE",
    content: "",
    image_url: "https://images.unsplash.com/photo-1666992883448-cdfb31e74ab6?w=800&h=400&fit=crop&q=80",
    caption: "Black and white, high contrast. The interior of a concrete stairwell, light entering from a window at the top, the geometry of the banister casting a shadow grid across the steps.",
    likeCount: 7,
    commentCount: 0,
    createdAt: "2026-04-13T18:00:00Z",
  },
  {
    id: "post-3",
    author: MOCK_USERS[2],
    type: "MUSIC",
    content: "This has been on repeat for three days. The way the vocal sits underneath the guitar rather than on top of it. The voice is not performing the song. The voice is inside the song.",
    likeCount: 12,
    commentCount: 4,
    createdAt: "2026-04-13T14:20:00Z",
  },
  {
    id: "post-4",
    author: MOCK_USERS[3],
    type: "ARTICLE",
    content: "The Procedural Republic and the Unencumbered Self — Michael Sandel",
    image_url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&h=300&fit=crop&q=80",
    caption: "The Sandel piece from 1984 that still hasn't been adequately answered. The argument is not that liberalism is wrong but that it requires a self that no one has — a self prior to its ends, capable of choosing its attachments from a position of detachment. The procedural republic presupposes the unencumbered self and the unencumbered self does not exist.",
    likeCount: 19,
    commentCount: 8,
    createdAt: "2026-04-12T10:00:00Z",
  },
  {
    id: "post-5",
    author: MOCK_USERS[4],
    type: "PREDICTION",
    content: "The EU AI Act's general-purpose AI provisions will require at least one major model provider to withdraw from the European market by end of 2027.",
    predictionMarket: { question: "The EU AI Act's general-purpose AI provisions will require at least one major model provider to withdraw from the European market by end of 2027", yesPrice: 0.28, volume: 4230 },
    likeCount: 6,
    commentCount: 3,
    createdAt: "2026-04-11T16:45:00Z",
  },
  {
    id: "post-6",
    author: MOCK_USERS[0],
    type: "LIBRARY",
    content: "",
    libraryTitle: "Reading group — Week 4: Attention & Perception",
    libraryItems: [
      "Crary, Jonathan — Suspensions of Perception (Ch. 2)",
      "Stiegler, Bernard — Taking Care of Youth and the Generations (Introduction)",
      "Simondon, Gilbert — \"The Genesis of the Individual\" (excerpt)",
      "Citton, Yves — The Ecology of Attention (Ch. 4–5)",
      "Merleau-Ponty — Phenomenology of Perception (Part I, §3)",
      "Weil, Simone — \"Reflections on the Right Use of School Studies\" (complete)",
    ],
    likeCount: 15,
    commentCount: 2,
    createdAt: "2026-04-10T12:00:00Z",
  },
  {
    id: "post-7",
    author: MOCK_USERS[1],
    type: "PRODUCT_REVIEW",
    content: "Libertine Libertine Smoke Trousers",
    productReview: { product_name: "Libertine Libertine Smoke Trousers", rating: 4, summary: "Wide straight leg, heavy cotton twill, sits high. The only trouser I've found that works for skating and doesn't look like skatewear. Seams held through six months of daily use including two rips I thought were terminal. The fabric broke in around week three — stiff before that. Size down if you're between." },
    likeCount: 4,
    commentCount: 2,
    createdAt: "2026-04-09T11:00:00Z",
  },
  {
    id: "post-8",
    author: MOCK_USERS[3],
    type: "TEXT",
    content: "Has anyone here read the Chiesa book on Lacan and sexuation — The Not-Two? Trying to work through the section on the phallic function and the formulas of sexuation and I think I need people to argue with. Specifically the claim that \"psychoanalysis amounts to the discourse that constitutes itself as the enunciation of the fact that the sexual relationship cannot be written.\" What does it mean for a discourse to constitute itself as an enunciation of an impossibility? Is this different from the discourse simply asserting the impossibility? The \"constitutes itself as\" is doing something I can't quite get hold of.",
    likeCount: 11,
    commentCount: 6,
    createdAt: "2026-04-08T20:00:00Z",
  },
];

const POST_TYPES = [
  { key: "TEXT", label: "Text", icon: Type, description: "Plain text post" },
  { key: "IMAGE", label: "Image", icon: Image, description: "Photo or image upload" },
  { key: "VIDEO", label: "Video", icon: Video, description: "Embedded video" },
  { key: "MUSIC", label: "Music", icon: Music, description: "SoundCloud player embed" },
  { key: "GALLERY", label: "Gallery", icon: LayoutGrid, description: "Multi-image carousel" },
  { key: "ARTICLE", label: "Article", icon: FileText, description: "Long-form article with hero image" },
  { key: "PREDICTION", label: "Prediction", icon: TrendingUp, description: "LMSR prediction market" },
  { key: "PRODUCT_REVIEW", label: "Product Review", icon: ShoppingBag, description: "Structured review with claims" },
  { key: "DRAW", label: "Draw", icon: Palette, description: "Canvas drawing" },
  { key: "CODE", label: "Code", icon: Code, description: "Code snippet" },
  { key: "LIVECHAT", label: "Livechat", icon: Zap, description: "Real-time chat node" },
  { key: "ENTROPY", label: "Entropy", icon: Sparkles, description: "Randomized content" },
  { key: "PORTAL", label: "Portal", icon: ExternalLink, description: "Link to external content" },
  { key: "DOCUMENT", label: "Document", icon: BookOpen, description: "PDF / document embed" },
  { key: "LIBRARY", label: "Library", icon: Layers, description: "PDF stacks & collections" },
  { key: "THREAD", label: "Thread", icon: MessageSquare, description: "Threaded discussion" },
  { key: "ROOM_CANVAS", label: "Room Canvas", icon: MapPin, description: "Spatial room embed" },
];

interface MockComment {
  id: string;
  author: typeof MOCK_USERS[0];
  text: string;
  likeCount: number;
  createdAt: string;
}

const MOCK_COMMENTS: MockComment[] = [
  { id: "c-1", author: MOCK_USERS[3], text: "That line about the Zibaldone. Leopardi's whole project is this — cataloguing the unrepeatable quality of moments that look ordinary from the outside.", likeCount: 3, createdAt: "2026-04-14T10:00:00Z" },
  { id: "c-2", author: MOCK_USERS[2], text: "North Beach at 4pm is a specific thing. The way the buildings cut the light.", likeCount: 1, createdAt: "2026-04-14T10:15:00Z" },
  { id: "c-3", author: MOCK_USERS[4], text: "Is this the passage where he talks about the window being half-closed and the light being filtered through the shutters?", likeCount: 2, createdAt: "2026-04-14T10:30:00Z" },
];

interface MockConversation {
  id: string;
  isGroup: boolean;
  title?: string;
  participants: typeof MOCK_USERS;
  lastMessage: { text: string; senderName: string; createdAt: string };
  unreadCount: number;
}

const MOCK_CONVERSATIONS: MockConversation[] = [
  { id: "conv-1", isGroup: false, participants: [MOCK_USERS[0], MOCK_USERS[1]], lastMessage: { text: "The stairwell photos are getting better", senderName: "Rimbaud", createdAt: "2026-04-14T09:45:00Z" }, unreadCount: 0 },
  { id: "conv-2", isGroup: true, title: "Reading Group", participants: [MOCK_USERS[0], MOCK_USERS[3], MOCK_USERS[2]], lastMessage: { text: "Week 4 readings posted", senderName: "Rimbaud", createdAt: "2026-04-14T08:30:00Z" }, unreadCount: 3 },
  { id: "conv-3", isGroup: false, participants: [MOCK_USERS[0], MOCK_USERS[2]], lastMessage: { text: "Have you heard the new Grouper record?", senderName: "Varda", createdAt: "2026-04-13T22:00:00Z" }, unreadCount: 1 },
  { id: "conv-4", isGroup: true, title: "Theory Channel", participants: [MOCK_USERS[0], MOCK_USERS[3], MOCK_USERS[4]], lastMessage: { text: "Started the Chiesa — it's dense", senderName: "Electra", createdAt: "2026-04-13T17:00:00Z" }, unreadCount: 0 },
];

interface MockMessage {
  id: string;
  sender: typeof MOCK_USERS[0];
  text: string;
  createdAt: string;
  replyTo?: { text: string; senderName: string };
  attachment?: { type: string; name: string };
  starred?: boolean;
}

const MOCK_MESSAGES: MockMessage[] = [
  { id: "msg-1", sender: MOCK_USERS[1], text: "Did you see the stairwell photos I posted?", createdAt: "2026-04-14T09:00:00Z" },
  { id: "msg-2", sender: MOCK_USERS[0], text: "Yes. The light at the top of the frame carries the whole image. Everything below it is just consequence.", createdAt: "2026-04-14T09:05:00Z", starred: true },
  { id: "msg-3", sender: MOCK_USERS[1], text: "Here's one I didn't post", createdAt: "2026-04-14T09:10:00Z", attachment: { type: "image", name: "stairwell-04.jpg" } },
  { id: "msg-4", sender: MOCK_USERS[0], text: "This one is better than the one you posted", createdAt: "2026-04-14T09:15:00Z", replyTo: { text: "Here's one I didn't post", senderName: "Simonides" } },
  { id: "msg-5", sender: MOCK_USERS[1], text: "Should I replace it?", createdAt: "2026-04-14T09:20:00Z" },
  { id: "msg-6", sender: MOCK_USERS[0], text: "No. Keep both up. The posted one works as the public version — the geometry is cleaner. This one is the better photograph but it needs the context of looking at it twice.", createdAt: "2026-04-14T09:25:00Z" },
];

interface MockRoom {
  id: string;
  name: string;
  icon: string;
  isPublic: boolean;
  memberCount: number;
  postCount: number;
  edgeCount: number;
  description: string;
}

const MOCK_ROOMS: MockRoom[] = [
  { id: "room-global", name: "Crypt", icon: "🏛️", isPublic: true, memberCount: 156, postCount: 423, edgeCount: 87, description: "The global public room — open discourse for all" },
  { id: "room-1", name: "Climate Policy Lab", icon: "🌍", isPublic: true, memberCount: 34, postCount: 89, edgeCount: 23, description: "Collaborative canvas for climate policy argumentation" },
  { id: "room-2", name: "AI Ethics Working Group", icon: "🤖", isPublic: false, memberCount: 12, postCount: 56, edgeCount: 15, description: "Private room for structured AI ethics deliberation" },
  { id: "room-3", name: "Creative Studio", icon: "🎨", isPublic: true, memberCount: 45, postCount: 134, edgeCount: 31, description: "Music, art, and multimedia collaboration space" },
];

interface MockRoomPost {
  id: string;
  type: string;
  content: string;
  x: number;
  y: number;
  author: typeof MOCK_USERS[0];
  locked: boolean;
}

const MOCK_ROOM_POSTS: MockRoomPost[] = [
  { id: "rp-1", type: "TEXT", content: "Carbon pricing overview", x: 100, y: 80, author: MOCK_USERS[0], locked: false },
  { id: "rp-2", type: "TEXT", content: "Equity concerns", x: 320, y: 150, author: MOCK_USERS[2], locked: false },
  { id: "rp-3", type: "IMAGE", content: "Emissions chart", x: 200, y: 280, author: MOCK_USERS[1], locked: true },
  { id: "rp-4", type: "TEXT", content: "Border adjustments", x: 450, y: 100, author: MOCK_USERS[4], locked: false },
  { id: "rp-5", type: "TEXT", content: "Revenue recycling", x: 380, y: 280, author: MOCK_USERS[3], locked: false },
];

const MOCK_ROOM_EDGES = [
  { source: "rp-1", target: "rp-2" },
  { source: "rp-1", target: "rp-4" },
  { source: "rp-2", target: "rp-5" },
  { source: "rp-3", target: "rp-5" },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const SOCIAL_FEATURES = [
  {
    id: "feed",
    step: "1.1",
    title: "Real-Time Feed",
    description: "Infinite-scrolling feed with live updates via Supabase broadcast",
    icon: Rss,
    color: "from-orange-500/10 to-amber-500/15",
    iconColor: "text-orange-600",
    items: [
      "RealtimeFeed — infinite scroll with cursor-based pagination",
      "Dual post model: FeedPost (main feed) + RealtimePost (room-scoped)",
      "Real-time updates via Supabase broadcast channels",
      "Post type filtering (TEXT, IMAGE, VIDEO, MUSIC, ARTICLE…)",
      "Global feed at / and room-scoped feeds per canvas",
      "Optional animated scroll mode for visual presentation",
    ],
  },
  {
    id: "post-types",
    step: "1.2",
    title: "17+ Post Types",
    description: "Rich content model with type-specific renderers in PostCard",
    icon: LayoutGrid,
    color: "from-violet-500/10 to-purple-500/15",
    iconColor: "text-violet-600",
    items: [
      "TEXT — plain text posts",
      "IMAGE / IMAGE_COMPUTE — uploads & AI-generated images",
      "VIDEO — YouTube and embedded video players",
      "MUSIC — SoundCloud player integration",
      "GALLERY — multi-image carousel with swipe navigation",
      "ARTICLE — long-form with hero image, reading time, slug",
      "PREDICTION — LMSR prediction market with YES/NO trading",
      "PRODUCT_REVIEW — structured reviews with claims & vouching",
      "CODE, DRAW, LIBRARY, PORTAL, ENTROPY, LIVECHAT, THREAD, DOCUMENT, ROOM_CANVAS",
      "CreateFeedPost — type selector + dedicated modals per type",
    ],
  },
  {
    id: "post-actions",
    step: "1.3",
    title: "Post Interactions",
    description: "Upvote, downvote, comment, repost, share — all with optimistic UI updates",
    icon: Heart,
    color: "from-rose-500/10 to-pink-500/15",
    iconColor: "text-rose-600",
    items: [
      "LikeButton — like/dislike/unlike with optimistic state updates",
      "ExpandButton — inline comment thread expansion",
      "ReplicateButton — repost content to your own feed",
      "ShareButton — copy link + external platform sharing",
      "TimerButton — set post expiration date",
      "DeleteCardButton — author-only post deletion",
      "Nested comment replies with threaded display",
    ],
  },
  {
    id: "profile",
    step: "2.1",
    title: "User Profiles",
    description: "ProfileHeader, tabbed content, attributes & customization",
    icon: Users,
    color: "from-sky-500/10 to-blue-500/15",
    iconColor: "text-sky-600",
    items: [
      "ProfileHeader — avatar, name, @username, bio, follow/message buttons",
      "Profile tabs: Posts, Tagged, Messages, Friends, About",
      "UserAttributes — interests, hobbies, location, music, movies, books",
      "Per-attribute visibility: PUBLIC / FOLLOWERS / PRIVATE",
      "Profile customization page (/profile/[id]/customize)",
      "Sub-pages: /profile/articles, /profile/stacks, /profile/deliberations",
    ],
  },
  {
    id: "friends",
    step: "2.2",
    title: "Friends & Following",
    description: "Mutual follow = friends. Suggestions via Pinecone vector search.",
    icon: UserPlus,
    color: "from-emerald-500/10 to-teal-500/15",
    iconColor: "text-emerald-600",
    items: [
      "FollowButton — three states: Follow → Following → Friends (mutual)",
      "FriendsTab — merged followings + followers with status labels",
      "Mutual follow = friends — no separate friend request system",
      "Friend suggestions: DeepSeek embeddings → Pinecone vector search",
      "UserCard — search results with inline follow button",
      "Automatic follow notifications via createFollowNotification()",
    ],
  },
  {
    id: "notifications",
    step: "2.3",
    title: "Notifications",
    description: "Follow, message, trade, market — with read/unread tracking",
    icon: Bell,
    color: "from-amber-500/10 to-yellow-500/15",
    iconColor: "text-amber-600",
    items: [
      "FOLLOW — new follower alerts",
      "MESSAGE — new message notifications",
      "TRADE_EXECUTED — prediction market trade confirmation",
      "MARKET_RESOLVED — prediction market outcome notifications",
      "Read / unread state tracking and bulk mark-read",
      "Notification center accessible from sidebar",
    ],
  },
  {
    id: "conversations",
    step: "3.1",
    title: "Conversations",
    description: "DMs, group chats, and conversation inbox management",
    icon: MessageSquare,
    color: "from-indigo-500/10 to-violet-500/15",
    iconColor: "text-indigo-600",
    items: [
      "ConversationList — unified DM + group chat inbox",
      "getOrCreateDM() — auto-creates DM on first message",
      "createGroupConversation() — group chat with title + participants",
      "GroupCreationModal + MessageUserModal for creation flows",
      "Unread count badges per conversation",
      "Conversation search and filtering",
    ],
  },
  {
    id: "chat",
    step: "3.2",
    title: "Real-Time Chat",
    description: "Virtualized messages, attachments, polls, drifts, quoting, starring",
    icon: Send,
    color: "from-cyan-500/10 to-sky-500/15",
    iconColor: "text-cyan-600",
    items: [
      "ChatRoom — virtualized message list with Supabase realtime channels",
      "MessageComposer — rich input with attachments, polls, Sheaf composer",
      "DriftChip / DriftPane — threaded sub-conversations within a chat",
      "QuoteBlock — reply to specific messages with inline context",
      "LinkCard — automatic URL preview card generation",
      "StarToggle / StarredFilterToggle — message bookmarking and filter",
      "PrivateChatDock — floating overlay chat for quick conversations",
      "Cursor-based message pagination with infinite scroll",
    ],
  },
  {
    id: "rooms",
    step: "4.1",
    title: "Spatial Rooms",
    description: "Canvases with posts positioned at x/y coordinates and edge connections between them.",
    icon: MapPin,
    color: "from-pink-500/10 to-rose-500/15",
    iconColor: "text-pink-600",
    items: [
      "RealtimeRoom — spatial canvas with x/y coordinate system",
      "RealtimePost — posts positioned on canvas with drag support",
      "RealtimeEdge — source → target connections between posts",
      "Room membership via UserRealtimeRoom join table",
      "Global 'Crypt' room — public-by-default community canvas",
      "Public vs private room access controls",
      "RoomLogbookFeed — chronological room activity log",
      "RoomCanvasForm — create posts directly on canvas",
    ],
  },
  {
    id: "stacks",
    step: "4.2",
    title: "Stacks",
    description: "Curated post collections with collaborators and discussions",
    icon: Layers,
    color: "from-slate-500/10 to-zinc-500/15",
    iconColor: "text-slate-600",
    items: [
      "Stack creation with title, description, public/private toggle",
      "Add/remove posts to curated collections",
      "Collaborator system — invite users to co-curate",
      "Stack discussion threads for commentary",
      "Stack discovery and browsing UI",
      "PDF stacks and library collection support",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function AvatarPlaceholder({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "w-6 h-6 text-[10px]", md: "w-8 h-8 text-xs", lg: "w-12 h-12 text-sm" };
  const colors = ["bg-indigo-200 text-indigo-700", "bg-emerald-200 text-emerald-700", "bg-amber-200 text-amber-700", "bg-rose-200 text-rose-700", "bg-violet-200 text-violet-700"];
  const colorIdx = name.charCodeAt(0) % colors.length;
  return (
    <div className={`${sizeClasses[size]} ${colors[colorIdx]} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function TimeAgo({ date }: { date: string }) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return <span>{mins}m</span>;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return <span>{hrs}h</span>;
  const days = Math.floor(hrs / 24);
  return <span>{days}d</span>;
}

function PostTypeIcon({ type }: { type: string }) {
  const entry = POST_TYPES.find((p) => p.key === type);
  if (!entry) return null;
  const Icon = entry.icon;
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-white/60 border border-slate-900/10 rounded-full px-2 py-0.5">
          <Icon className="w-3 h-3" /> {entry.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{entry.description}</TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE CARD (matches embed demo cardv2 style)
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof SOCIAL_FEATURES)[0] }) {
  const Icon = feature.icon;
  return (
    <div className="cardv2 h-full flex flex-col">
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${feature.color} ${feature.iconColor} shrink-0`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 font-mono">Step {feature.step}</span>
              </div>
              <p className="font-semibold text-slate-900 text-[14px] leading-tight">{feature.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{feature.description}</p>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/25">
            <Check className="w-2.5 h-2.5" />
            Done
          </span>
        </div>
      </div>
      <div className="px-5 pb-5 flex-1">
        <ul className="space-y-1.5">
          {feature.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-snug">
              <div className="w-1 h-1 rounded-full bg-orange-400/70 flex-shrink-0 mt-[5px]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Feed & Posts
// ─────────────────────────────────────────────────────────────────────────────

function FeedPostsDemo() {
  const [filter, setFilter] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const filteredPosts = filter ? MOCK_POSTS.filter((p) => p.type === filter) : MOCK_POSTS;

  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/12 to-amber-500/12 text-orange-600">
            <Rss className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Feed & Post Interactions</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-orange-500/10 to-amber-500/10 text-orange-700 border border-orange-500/20">Interactive</span>
        </div>
        <p className="text-sm text-slate-500">
          The main feed uses RealtimeFeed with infinite scroll and live Supabase broadcast updates.
          Every post is rendered by PostCard with type-specific sections and a rich action bar.
        </p>
      </div>

      <div className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter(null)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              filter === null ? "border-orange-400 bg-orange-50 text-orange-700 ring-2 ring-orange-200" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            All types
          </button>
          {["TEXT", "IMAGE", "MUSIC", "ARTICLE", "PREDICTION", "PRODUCT_REVIEW", "LIBRARY"].map((type) => {
            const entry = POST_TYPES.find((p) => p.key === type)!;
            const Icon = entry.icon;
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  filter === type ? "border-orange-400 bg-orange-50 text-orange-700 ring-2 ring-orange-200" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-3 h-3" /> {entry.label}
              </button>
            );
          })}
        </div>

        {/* Posts */}
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const vote = votes[post.id];
            const expanded = expandedPost === post.id;
            return (
              <div key={post.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4">
                  {/* Author row */}
                  <div className="flex items-center gap-3 mb-3">
                    <AvatarPlaceholder name={post.author.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{post.author.name}</span>
                        <span className="text-xs text-slate-400">@{post.author.username}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <TimeAgo date={post.createdAt} />
                        <PostTypeIcon type={post.type} />
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  {post.content && <p className="text-sm text-slate-700 leading-relaxed mb-3">{post.content}</p>}

                  {/* Type-specific media */}
                  {post.type === "IMAGE" && (
                    <div className="mb-3 rounded-lg overflow-hidden">
                      {post.image_url && post.image_url !== "placeholder" ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={post.image_url} alt={post.caption || "Image attachment"} className="w-full h-auto object-cover" />
                      ) : (
                        <div className="h-44 flex items-center justify-center text-indigo-400/60 px-6" style={{ background: "linear-gradient(135deg, #e0e7ff, #dbeafe, #e0e7ff)" }}>
                          <Image className="w-8 h-8 mr-2" /> <span className="text-sm font-medium">Image attachment</span>
                        </div>
                      )}
                      {post.caption && <p className="text-xs text-slate-500 italic leading-relaxed px-1 pt-2">{post.caption}</p>}
                    </div>
                  )}
                  {post.type === "MUSIC" && (
                    <div className="mb-3 rounded-lg overflow-hidden bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-sm"><Music className="w-5 h-5 text-white" /></div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-orange-800">SoundCloud Player</div>
                        <div className="text-[10px] text-orange-500 mt-0.5">Grouper — Headache</div>
                        <div className="w-full h-1.5 bg-orange-200/60 rounded-full mt-1.5 overflow-hidden">
                          <div className="w-1/3 h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}
                  {post.type === "ARTICLE" && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-slate-200">
                      {post.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={post.image_url} alt={post.content || "Article hero"} className="w-full h-28 object-cover" />
                      ) : (
                        <div className="h-28" style={{ background: "linear-gradient(135deg, #eef2ff, #e0e7ff, #dbeafe)" }}>
                          <div className="h-full flex items-center justify-center text-indigo-400/50">
                            <FileText className="w-6 h-6 mr-2" /> <span className="text-xs font-medium">Hero Image</span>
                          </div>
                        </div>
                      )}
                      <div className="p-3 bg-slate-50/80">
                        <p className="text-xs text-slate-500 line-clamp-2">{post.caption}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                          <Clock className="w-3 h-3" /> 14 min read
                          <span>·</span>
                          <Eye className="w-3 h-3" /> 1.2k views
                        </div>
                      </div>
                    </div>
                  )}
                  {post.type === "PREDICTION" && post.predictionMarket && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 rounded-md bg-emerald-500/10"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /></div>
                        <span className="text-xs font-semibold text-emerald-800">Prediction Market (LMSR)</span>
                      </div>
                      <p className="text-sm text-emerald-900 font-medium mb-3">{post.predictionMarket.question}</p>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-[10px] font-semibold mb-1">
                            <span className="text-emerald-600">YES {(post.predictionMarket.yesPrice * 100).toFixed(0)}¢</span>
                            <span className="text-rose-500">NO {((1 - post.predictionMarket.yesPrice) * 100).toFixed(0)}¢</span>
                          </div>
                          <div className="w-full h-2.5 bg-rose-200/60 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all" style={{ width: `${post.predictionMarket.yesPrice * 100}%` }} />
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">Vol: ${post.predictionMarket.volume.toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors" onClick={() => toast.info("Buy YES position")}>Buy YES</button>
                        <button className="flex-1 py-1.5 rounded-lg border border-rose-300 text-rose-600 text-xs font-semibold hover:bg-rose-50 transition-colors" onClick={() => toast.info("Buy NO position")}>Buy NO</button>
                      </div>
                    </div>
                  )}
                  {post.type === "PRODUCT_REVIEW" && post.productReview && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 rounded-md bg-amber-500/10"><ShoppingBag className="w-3.5 h-3.5 text-amber-600" /></div>
                        <span className="text-xs font-semibold text-amber-800">Product Review</span>
                        <div className="ml-auto flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < post.productReview!.rating ? "text-amber-500 fill-amber-500" : "text-amber-200"}`} />
                          ))}
                          <span className="text-xs font-bold text-amber-700 ml-1">{post.productReview.rating}/5</span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-amber-900 mb-1">{post.productReview.product_name}</p>
                      <p className="text-xs text-amber-700 leading-relaxed">{post.productReview.summary}</p>
                    </div>
                  )}
                  {post.type === "LIBRARY" && post.libraryItems && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 rounded-md bg-indigo-500/10"><Layers className="w-3.5 h-3.5 text-indigo-600" /></div>
                        <span className="text-xs font-semibold text-indigo-800">PDF Stack: {post.libraryItems.length} documents</span>
                      </div>
                      {post.libraryTitle && <p className="text-sm font-semibold text-indigo-900 mb-2">{post.libraryTitle}</p>}
                      <ul className="space-y-1">
                        {post.libraryItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-indigo-700">
                            <span className="text-indigo-400 mt-0.5">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="flex items-center gap-0.5 pt-2 border-t border-slate-100">
                    <button
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${vote === "up" ? "text-orange-600 bg-orange-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                      onClick={() => {
                        const next = { ...votes };
                        if (vote === "up") delete next[post.id]; else next[post.id] = "up";
                        setVotes(next);
                        toast.info(vote === "up" ? "Removed upvote" : "Upvoted");
                      }}
                    >
                      <ChevronUp className="w-4 h-4" />
                      {post.likeCount + (vote === "up" ? 1 : 0)}
                    </button>
                    <button
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${vote === "down" ? "text-violet-500 bg-violet-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                      onClick={() => {
                        const next = { ...votes };
                        if (vote === "down") delete next[post.id]; else next[post.id] = "down";
                        setVotes(next);
                        toast.info(vote === "down" ? "Removed downvote" : "Downvoted");
                      }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${expanded ? "text-orange-500 bg-orange-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                      onClick={() => setExpandedPost(expanded ? null : post.id)}
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> {post.commentCount}
                    </button>
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all" onClick={() => toast.success("Reposted to your feed")}>
                      <Repeat2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all" onClick={() => toast.info("Link copied")}>
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all" onClick={() => toast.info("Saved to bookmarks")}>
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Expanded comments */}
                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                      {MOCK_COMMENTS.map((c) => (
                        <div key={c.id} className="flex gap-2">
                          <AvatarPlaceholder name={c.author.name} size="sm" />
                          <div className="flex-1 rounded-lg bg-slate-50 p-2.5">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-slate-700">{c.author.name}</span>
                              <span className="text-[10px] text-slate-400"><TimeAgo date={c.createdAt} /></span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{c.text}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <button className="text-[10px] text-slate-400 hover:text-rose-500 flex items-center gap-0.5 transition-colors"><Heart className="w-3 h-3" /> {c.likeCount}</button>
                              <button className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">Reply</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <AvatarPlaceholder name="Rimbaud" size="sm" />
                        <div className="flex-1 flex gap-2">
                          <input
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                            placeholder="Write a comment…"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                          />
                          <button
                            className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50"
                            disabled={!commentText.trim()}
                            onClick={() => { toast.success("Comment posted"); setCommentText(""); }}
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Load more */}
        <div className="text-center pt-2">
          <button className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-500 transition-all" onClick={() => toast.info("Loading more… (infinite scroll)")}>
            <ChevronRight className="w-3.5 h-3.5" /> Load more posts
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Profile & Social
// ─────────────────────────────────────────────────────────────────────────────

function ProfileSocialDemo() {
  const [followStates, setFollowStates] = useState<Record<string, "none" | "following" | "friends">>({ "user-2": "friends", "user-3": "friends", "user-4": "following", "user-5": "none" });
  const [activeProfileTab, setActiveProfileTab] = useState("posts");
  const user = MOCK_USERS[0];

  const NOTIFICATIONS = [
    { id: "n-1", type: "FOLLOW", icon: UserPlus, color: "text-blue-500", text: "Pyrrho started following you", time: "2h", read: false },
    { id: "n-2", type: "MESSAGE", icon: MessageSquare, color: "text-emerald-500", text: "Simonides sent you a message", time: "3h", read: false },
    { id: "n-3", type: "FOLLOW", icon: UserPlus, color: "text-blue-500", text: "Electra started following you", time: "1d", read: true },
    { id: "n-4", type: "TRADE_EXECUTED", icon: TrendingUp, color: "text-amber-500", text: "Your trade on 'EU AI Act withdrawal' was executed", time: "1d", read: true },
    { id: "n-5", type: "MARKET_RESOLVED", icon: Check, color: "text-emerald-500", text: "Market 'Open-source LLMs surpass GPT-4' resolved YES", time: "2d", read: true },
  ];

  const [readNotifs, setReadNotifs] = useState<Set<string>>(new Set(NOTIFICATIONS.filter((n) => n.read).map((n) => n.id)));

  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500/12 to-blue-500/12 text-sky-600">
            <Users className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Profile &amp; Social Graph</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-sky-500/10 to-blue-500/10 text-sky-700 border border-sky-500/20">Interactive</span>
        </div>
        <p className="text-sm text-slate-500">
          Explore user profiles, the mutual-follow friend system, AI-powered suggestions, and the notification center.
        </p>
      </div>

      <div className="space-y-5">
        {/* Profile Header Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="h-20" style={{ background: "linear-gradient(135deg, #fed7aa, #fdba74, #fbbf24, #f59e0b)" }} />
          <div className="px-5 pb-5 -mt-6">
            <div className="flex items-end gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-200 to-amber-200 border-4 border-white flex items-center justify-center text-xl font-bold text-orange-700 shadow-sm">R</div>
              <div className="flex-1 pt-7">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-800">{user.name}</h3>
                  <span className="text-xs text-slate-400 font-mono">@{user.username}</span>
                </div>
                <p className="text-sm text-slate-500">{user.bio}</p>
              </div>
              <div className="flex gap-2 pt-7">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all" onClick={() => toast.info("Opening message composer")}>
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" /> Message
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-all" onClick={() => toast.info("Follow state toggled")}>
                  <UserPlus className="w-3.5 h-3.5" /> Follow
                </button>
              </div>
            </div>
            <div className="flex items-center gap-5 mt-3 text-xs text-slate-500">
              <span><strong className="text-slate-800">234</strong> followers</span>
              <span><strong className="text-slate-800">189</strong> following</span>
              <span><strong className="text-slate-800">56</strong> posts</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {user.location}</span>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab}>
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="posts" className="text-xs gap-1"><Rss className="w-3 h-3" /> Posts</TabsTrigger>
            <TabsTrigger value="friends" className="text-xs gap-1"><Users className="w-3 h-3" /> Friends</TabsTrigger>
            <TabsTrigger value="about" className="text-xs gap-1"><BookOpen className="w-3 h-3" /> About</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs gap-1">
              <Bell className="w-3 h-3" /> Notifications
              {NOTIFICATIONS.filter((n) => !readNotifs.has(n.id)).length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {NOTIFICATIONS.filter((n) => !readNotifs.has(n.id)).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-3">
            <div className="space-y-2">
              {MOCK_POSTS.filter((p) => p.author.id === "user-1").slice(0, 3).map((post) => (
                <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer">
                  <PostTypeIcon type={post.type} />
                  <p className="text-sm text-slate-700 flex-1 line-clamp-1">{post.content}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                    <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {post.likeCount}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {post.commentCount}</span>
                    <TimeAgo date={post.createdAt} />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="friends" className="mt-3 space-y-3">
            {MOCK_USERS.slice(1).map((u) => {
              const state = followStates[u.id] ?? "none";
              return (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                  <AvatarPlaceholder name={u.name} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-700">{u.name}</span>
                    <p className="text-xs text-slate-400 truncate">@{u.username} · {u.bio}</p>
                  </div>
                  <button
                    onClick={() => {
                      const next = state === "none" ? "following" : state === "following" ? "friends" : "none";
                      setFollowStates({ ...followStates, [u.id]: next });
                      const labels: Record<string, string> = { none: "Unfollowed", following: "Now following", friends: "Now friends!" };
                      toast.info(labels[next]);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-w-[100px] justify-center ${
                      state === "friends" ? "border border-emerald-300 bg-emerald-50 text-emerald-700" :
                      state === "following" ? "border border-sky-300 bg-sky-50 text-sky-700" :
                      "bg-orange-600 text-white hover:bg-orange-700"
                    }`}
                  >
                    {state === "friends" && <><UserCheck className="w-3.5 h-3.5" /> Friends</>}
                    {state === "following" && <><Check className="w-3.5 h-3.5" /> Following</>}
                    {state === "none" && <><UserPlus className="w-3.5 h-3.5" /> Follow</>}
                  </button>
                </div>
              );
            })}

            {/* AI Suggestions */}
            <div className="rounded-lg border border-dashed border-orange-300 bg-gradient-to-r from-orange-50/80 to-amber-50/80 p-4 space-y-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-semibold text-orange-800">Friend Suggestions</span>
                <span className="text-[10px] text-orange-500 ml-auto">via DeepSeek + Pinecone</span>
              </div>
              {[
                { name: "Jordan Rivers", reason: "Shared interests: AI, Philosophy", score: 92 },
                { name: "Kim Park", reason: "Same city, similar music taste", score: 87 },
              ].map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <AvatarPlaceholder name={s.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-700">{s.name}</span>
                    <p className="text-[10px] text-orange-600">{s.reason}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 mr-2">{s.score}%</span>
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 text-white text-[10px] font-semibold hover:bg-orange-700 transition-colors" onClick={() => toast.success(`Followed ${s.name}`)}>
                    <UserPlus className="w-3 h-3" /> Follow
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="about" className="mt-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {user.interests.map((i) => (
                    <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-orange-100/80 text-orange-700">{i}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Location</p>
                <p className="text-sm text-slate-700 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {user.location}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Attribute Visibility</p>
                <div className="flex gap-2">
                  {[
                    { label: "Events: Public", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                    { label: "Music: Followers", color: "bg-sky-100 text-sky-700 border-sky-200" },
                    { label: "Movies: Private", color: "bg-slate-100 text-slate-500 border-slate-200" },
                  ].map((v) => (
                    <span key={v.label} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${v.color}`}>{v.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-3">
            <div className="space-y-1">
              {NOTIFICATIONS.map((n) => {
                const Icon = n.icon;
                const isRead = readNotifs.has(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => { const next = new Set(readNotifs); next.add(n.id); setReadNotifs(next); toast.info("Marked as read"); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${isRead ? "hover:bg-slate-50" : "bg-orange-50/80 border border-orange-200/60 hover:bg-orange-100/60"}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${n.color}`} />
                    <p className={`text-sm flex-1 ${isRead ? "text-slate-500" : "text-slate-800 font-medium"}`}>{n.text}</p>
                    <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                    {!isRead && <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Messaging
// ─────────────────────────────────────────────────────────────────────────────

function MessagingDemo() {
  const [selectedConv, setSelectedConv] = useState<string>("conv-1");
  const [messageText, setMessageText] = useState("");
  const [starredFilter, setStarredFilter] = useState(false);
  const [localStars, setLocalStars] = useState<Set<string>>(new Set(MOCK_MESSAGES.filter((m) => m.starred).map((m) => m.id)));

  const displayedMessages = starredFilter ? MOCK_MESSAGES.filter((m) => localStars.has(m.id)) : MOCK_MESSAGES;

  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/12 to-violet-500/12 text-indigo-600">
            <MessageSquare className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Messaging &amp; Chat</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-700 border border-indigo-500/20">Interactive</span>
        </div>
        <p className="text-sm text-slate-500">
          DMs and group chats with real-time delivery via Supabase channels. Features include drifts (sub-threads), polls, quoting, starring, and URL previews.
        </p>
      </div>

      <div className="space-y-4">
        {/* Split layout: conversation list + chat */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-5">
            {/* Conversation list */}
            <div className="col-span-2 border-r border-slate-100">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Messages</span>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="p-1 rounded hover:bg-slate-100 transition-colors" onClick={() => toast.info("New DM (MessageUserModal)")}>
                        <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">New DM</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="p-1 rounded hover:bg-slate-100 transition-colors" onClick={() => toast.info("New Group (GroupCreationModal)")}>
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">New Group</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {MOCK_CONVERSATIONS.map((conv) => {
                  const isSelected = selectedConv === conv.id;
                  const otherUser = conv.participants.find((p) => p.id !== "user-1");
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConv(conv.id)}
                      className={`w-full flex items-center gap-2.5 p-3 text-left transition-all ${isSelected ? "bg-indigo-50/80" : "hover:bg-slate-50"}`}
                    >
                      {conv.isGroup ? (
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0"><Users className="w-3.5 h-3.5 text-violet-600" /></div>
                      ) : (
                        <AvatarPlaceholder name={otherUser?.name ?? "?"} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs truncate ${isSelected ? "font-semibold text-indigo-700" : "font-medium text-slate-700"}`}>{conv.title ?? otherUser?.name}</span>
                          {conv.isGroup && <span className="text-[9px] text-violet-500 font-medium bg-violet-50 px-1 rounded">Group</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">{conv.lastMessage.senderName}: {conv.lastMessage.text}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[9px] text-slate-400"><TimeAgo date={conv.lastMessage.createdAt} /></span>
                        {conv.unreadCount > 0 && (
                          <span className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] flex items-center justify-center font-bold">{conv.unreadCount}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chat area */}
            <div className="col-span-3 flex flex-col">
              {/* Header */}
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AvatarPlaceholder name="Simonides" size="sm" />
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Simonides</span>
                    <p className="text-[10px] text-slate-400">Active 5m ago</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={`p-1.5 rounded-md transition-all ${starredFilter ? "bg-amber-100 text-amber-600" : "hover:bg-slate-100 text-slate-400"}`}
                        onClick={() => { setStarredFilter(!starredFilter); toast.info(starredFilter ? "All messages" : "Starred only"); }}
                      >
                        <Star className={`w-3.5 h-3.5 ${starredFilter ? "fill-amber-500" : ""}`} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Starred filter</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-all" onClick={() => toast.info("Drift sub-thread")}>
                        <Hash className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">DriftPane</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 px-3 py-2 space-y-1 max-h-72 overflow-y-auto">
                {displayedMessages.map((msg) => {
                  const isMe = msg.sender.id === "user-1";
                  const isStarred = localStars.has(msg.id);
                  return (
                    <div key={msg.id} className={`flex gap-2 group ${isMe ? "flex-row-reverse" : ""}`}>
                      {!isMe && <AvatarPlaceholder name={msg.sender.name} size="sm" />}
                      <div className={`max-w-[75%] ${isMe ? "ml-auto" : ""}`}>
                        {msg.replyTo && (
                          <div className="text-[9px] text-slate-400 mb-0.5 flex items-center gap-1 px-1">
                            <Quote className="w-2.5 h-2.5" /> Replying to {msg.replyTo.senderName}
                          </div>
                        )}
                        <div className={`relative rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-br-sm shadow-sm"
                            : "bg-slate-100 text-slate-800 rounded-bl-sm"
                        }`}>
                          {msg.replyTo && (
                            <div className={`text-[9px] mb-1 px-2 py-0.5 rounded ${isMe ? "bg-white/15" : "bg-slate-200/80"}`}>
                              {msg.replyTo.text}
                            </div>
                          )}
                          {msg.text}
                          {msg.attachment && (
                            <div className={`mt-1 flex items-center gap-1 text-[10px] ${isMe ? "text-indigo-200" : "text-slate-400"}`}>
                              <Paperclip className="w-3 h-3" /> {msg.attachment.name}
                            </div>
                          )}
                          {/* Hover actions */}
                          <div className={`absolute top-0 ${isMe ? "left-0 -translate-x-full" : "right-0 translate-x-full"} opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 px-1`}>
                            <button onClick={() => { const n = new Set(localStars); if (isStarred) n.delete(msg.id); else n.add(msg.id); setLocalStars(n); }} className="p-0.5 rounded hover:bg-slate-200 transition-colors">
                              <Star className={`w-3 h-3 ${isStarred ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                            </button>
                            <button className="p-0.5 rounded hover:bg-slate-200 transition-colors" onClick={() => toast.info("Reply")}>
                              <Quote className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>
                        </div>
                        <div className={`text-[8px] text-slate-400 mt-0.5 px-1 ${isMe ? "text-right" : ""}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {isStarred && <Star className="w-2 h-2 inline ml-1 text-amber-400 fill-amber-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              <div className="p-3 border-t border-slate-100 flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-all" onClick={() => toast.info("Attach file")}><Paperclip className="w-4 h-4" /></button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Attachment</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-all" onClick={() => toast.info("QuickPollComposer")}><BarChart3 className="w-4 h-4" /></button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">In-chat poll</TooltipContent>
                </Tooltip>
                <input
                  className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Type a message…"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && messageText.trim()) { toast.success("Sent"); setMessageText(""); } }}
                />
                <button
                  className="p-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                  disabled={!messageText.trim()}
                  onClick={() => { toast.success("Sent"); setMessageText(""); }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chat feature chips */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Hash, title: "Drifts", desc: "Threaded sub-conversations", color: "text-indigo-500" },
            { icon: BarChart3, title: "Polls", desc: "In-chat voting", color: "text-violet-500" },
            { icon: LinkIcon, title: "Link Cards", desc: "Auto URL previews", color: "text-cyan-500" },
            { icon: Quote, title: "Quoting", desc: "Reply with context", color: "text-amber-500" },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-slate-200 bg-white/80 p-2.5 flex items-start gap-2">
              <f.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${f.color}`} />
              <div>
                <p className="text-[11px] font-semibold text-slate-700">{f.title}</p>
                <p className="text-[10px] text-slate-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Rooms & Spaces
// ─────────────────────────────────────────────────────────────────────────────

function RoomsSpacesDemo() {
  const [selectedRoom, setSelectedRoom] = useState<string>("room-global");
  const [hoveredPost, setHoveredPost] = useState<string | null>(null);

  const STACKS = [
    { title: "Best of Climate Discourse", desc: "Curated posts from climate deliberations", posts: 15, collaborators: ["Rimbaud", "Electra"], isPublic: true },
    { title: "AI Ethics Reading List", desc: "Key articles on AI alignment", posts: 8, collaborators: ["Electra"], isPublic: true },
    { title: "Sound & Perception", desc: "Tutorials, tools, and inspiration", posts: 22, collaborators: ["Varda", "Simonides"], isPublic: false },
  ];

  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500/12 to-rose-500/12 text-pink-600">
            <MapPin className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Rooms &amp; Spaces</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-pink-500/10 to-rose-500/10 text-pink-700 border border-pink-500/20">Interactive</span>
        </div>
        <p className="text-sm text-slate-500">
          Spatial canvas rooms where posts have x/y coordinates — like Miro boards for discourse.
          Stacks let users curate collections of posts with collaborators.
        </p>
      </div>

      <div className="space-y-5">
        {/* Room list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Room Browser</p>
          <div className="grid grid-cols-2 gap-2">
            {MOCK_ROOMS.map((room) => {
              const isSelected = selectedRoom === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    isSelected ? "border-pink-300 bg-pink-50/80 ring-2 ring-pink-200" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="text-xl">{room.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700">{room.name}</span>
                      {room.isPublic ? <Globe className="w-3 h-3 text-emerald-500" /> : <Lock className="w-3 h-3 text-slate-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{room.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-400">
                      <span>{room.memberCount} members</span>
                      <span>·</span>
                      <span>{room.postCount} posts</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spatial canvas */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Spatial Canvas (x/y coordinates + edges)</p>
          <div className="relative w-full h-80 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white overflow-hidden shadow-inner">
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

            {/* SVG Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
              {MOCK_ROOM_EDGES.map((edge) => {
                const source = MOCK_ROOM_POSTS.find((p) => p.id === edge.source);
                const target = MOCK_ROOM_POSTS.find((p) => p.id === edge.target);
                if (!source || !target) return null;
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={source.x + 60}
                    y1={source.y + 20}
                    x2={target.x + 60}
                    y2={target.y + 20}
                    stroke="#f9a8d4"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    opacity={0.6}
                  />
                );
              })}
            </svg>

            {/* Post nodes */}
            {MOCK_ROOM_POSTS.map((post) => {
              const isHovered = hoveredPost === post.id;
              return (
                <div
                  key={post.id}
                  onMouseEnter={() => setHoveredPost(post.id)}
                  onMouseLeave={() => setHoveredPost(null)}
                  className={`absolute rounded-lg border bg-white/95 backdrop-blur-sm cursor-pointer transition-all duration-200 ${
                    isHovered ? "border-pink-300 shadow-lg shadow-pink-100/50 scale-105 z-10" : "border-slate-200 shadow-sm z-[2]"
                  }`}
                  style={{ left: post.x, top: post.y, padding: "8px 12px" }}
                >
                  <div className="flex items-center gap-1.5">
                    {post.locked && <Lock className="w-2.5 h-2.5 text-slate-400" />}
                    <span className="text-[11px] font-semibold text-slate-700">{post.content}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{post.author.name}</div>
                  {isHovered && (
                    <div className="flex gap-1 mt-1.5">
                      <button className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors" onClick={() => toast.info("Move post")}>Move</button>
                      <button className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors" onClick={() => toast.info("Connect edge")}>Connect</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><CircleDot className="w-3 h-3 text-pink-400" /> {MOCK_ROOM_POSTS.length} posts</span>
            <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-pink-400" /> {MOCK_ROOM_EDGES.length} edges</span>
            <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-slate-400" /> {MOCK_ROOM_POSTS.filter((p) => p.locked).length} locked</span>
          </div>
        </div>

        {/* Stacks */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Stacks — Curated Collections</p>
          <div className="space-y-2">
            {STACKS.map((stack) => (
              <div key={stack.title} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-800">{stack.title}</span>
                      {stack.isPublic ? (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700">Public</span>
                      ) : (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Private</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{stack.desc}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{stack.posts} posts · {stack.collaborators.length} collaborator{stack.collaborators.length > 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex -space-x-1">
                    {stack.collaborators.map((name) => <AvatarPlaceholder key={name} name={name} size="sm" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SocialFeaturesPage() {
  return (
    <TooltipProvider>
      <Toaster position="bottom-right" richColors />
      <div className="min-h-screen" style={{ background: "linear-gradient(145deg, #fffbf5 0%, #fff7ed 25%, #fef3e2 50%, #fffbf5 75%, #fefce8 100%)" }}>

        {/* Sticky header */}
        <div
          className="border-b border-slate-900/[0.07] bg-white/85 backdrop-blur-xl sticky top-0 z-40 px-6 py-4"
          style={{ boxShadow: "0 1px 3px rgba(234,88,12,0.06), 0 4px 16px -8px rgba(234,88,12,0.08)" }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600">
                  <Home className="w-5 h-5 text-white" />
                </div>
                Social Platform Layer
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Feed, Posts, Profiles, Friends, Messaging, Rooms &amp; Stacks ·{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">/test/social-features</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-orange-600 text-white shadow-sm">
                <Check className="w-3 h-3 mr-1" />
                10 Features
              </Badge>
              <Badge variant="outline" className="text-slate-500">17+ post types</Badge>
              <Badge variant="outline" className="text-slate-500">4 modules</Badge>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* Strategic context banner */}
          <div className="rounded-xl bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 border border-orange-100/80 p-5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  The social layer that makes discourse stick.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Mesh is a full social platform — feed, profiles, friends, messaging, rooms, libraries — designed as community infrastructure rather than an extraction apparatus. No algorithm. No ads. No engagement optimization. Chronological feed. Community-owned data. Every interaction is real-time via Supabase broadcast. When a community&apos;s conversation needs structure, the deliberation engine is one transition away. When it doesn&apos;t, the social layer is complete on its own.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    { label: "Real-time Feed", color: "bg-orange-100 text-orange-700" },
                    { label: "17+ Post Types", color: "bg-violet-100 text-violet-700" },
                    { label: "Mutual-Follow Friends", color: "bg-emerald-100 text-emerald-700" },
                    { label: "DMs + Group Chat", color: "bg-indigo-100 text-indigo-700" },
                    { label: "Spatial Canvas Rooms", color: "bg-pink-100 text-pink-700" },
                    { label: "Prediction Markets", color: "bg-teal-100 text-teal-700" },
                    { label: "Friend Suggestions", color: "bg-sky-100 text-sky-700" },
                    { label: "Curated Stacks", color: "bg-amber-100 text-amber-700" },
                  ].map((chip) => (
                    <span key={chip.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${chip.color}`}>
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Platform anatomy */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">Platform anatomy — four social layers</p>
            <div className="flex items-stretch gap-1">
              {[
                { step: "1", label: "Feed is the surface", sub: "Infinite-scroll, 17+ post types, real-time via Supabase", module: "Feed & Posts", active: true },
                { step: "2", label: "Identity is the anchor", sub: "Profiles, attributes, mutual-follow friends, discovery", module: "Profiles & Social" },
                { step: "3", label: "Chat is the glue", sub: "DMs, group chats, drifts, polls, starring, quoting", module: "Messaging" },
                { step: "4", label: "Rooms are the canvas", sub: "Spatial x/y posts, edge connections, stacks, collaboration", module: "Rooms & Spaces" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-lg p-3 border transition-all ${
                    item.active
                      ? "border-orange-300 bg-orange-50 ring-2 ring-orange-200"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      item.active ? "bg-orange-500 text-white" : "bg-slate-300 text-white"
                    }`}>{item.step}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                      item.active ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                    }`}>{item.module}</span>
                  </div>
                  <p className={`text-xs font-semibold leading-tight ${item.active ? "text-orange-800" : "text-slate-700"}`}>{item.label}</p>
                  <p className={`text-[11px] mt-0.5 leading-snug ${item.active ? "text-orange-600" : "text-slate-400"}`}>{item.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Feature grid */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Feature Inventory</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  10 feature areas across 4 modules. All components are production-ready.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SOCIAL_FEATURES.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          </section>

          {/* Interactive demos */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Interactive Demos</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Explore the feed, profile experience, messaging UI, and spatial room canvas. All data is seeded — interactions use toast feedback.
              </p>
            </div>
            <Tabs defaultValue="feed" className="space-y-4">
              <TabsList className="bg-white border shadow-sm">
                <TabsTrigger value="feed" className="gap-1.5">
                  <Rss className="w-4 h-4" />
                  Feed &amp; Posts
                </TabsTrigger>
                <TabsTrigger value="social" className="gap-1.5">
                  <Users className="w-4 h-4" />
                  Profile &amp; Social
                </TabsTrigger>
                <TabsTrigger value="messaging" className="gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  Messaging
                </TabsTrigger>
                <TabsTrigger value="rooms" className="gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Rooms &amp; Spaces
                </TabsTrigger>
              </TabsList>

              <TabsContent value="feed">
                <FeedPostsDemo />
              </TabsContent>

              <TabsContent value="social">
                <ProfileSocialDemo />
              </TabsContent>

              <TabsContent value="messaging">
                <MessagingDemo />
              </TabsContent>

              <TabsContent value="rooms">
                <RoomsSpacesDemo />
              </TabsContent>
            </Tabs>
          </section>

          {/* Architecture grid */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">How It&apos;s Built</h2>
              <p className="text-sm text-slate-500 mt-0.5">Four social layers, each with dedicated server actions, components, and real-time infrastructure.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-orange-500/15 text-orange-600 text-[11px] font-bold flex items-center justify-center">1</span>
                  <Rss className="w-3.5 h-3.5 text-orange-600" />
                  <p className="text-sm font-semibold text-slate-800">Feed Layer</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-orange-700">RealtimeFeed.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-amber-700">PostCard.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-orange-600">CreateFeedPost.tsx</div>
                </div>
                <p className="text-xs text-slate-500">
                  Uses <code className="bg-white/50 px-1 rounded">fetchFeedPosts()</code> for SSR + <code className="bg-white/50 px-1 rounded">useInfiniteRealtimePosts</code> for infinite scroll. Posts are <code className="bg-white/50 px-1 rounded">BasePost</code> typed via <code className="bg-white/50 px-1 rounded">mapFeedPost()</code>.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/15 text-sky-600 text-[11px] font-bold flex items-center justify-center">2</span>
                  <Users className="w-3.5 h-3.5 text-sky-600" />
                  <p className="text-sm font-semibold text-slate-800">Social Layer</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-sky-700">ProfileHeader.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-emerald-700">follow.actions.ts</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">friend-suggestions.actions.ts</div>
                </div>
                <p className="text-xs text-slate-500">
                  Mutual follows via <code className="bg-white/50 px-1 rounded">areFriends()</code>. Suggestions via <code className="bg-white/50 px-1 rounded">DeepSeek embeddings</code> → <code className="bg-white/50 px-1 rounded">Pinecone</code> nearest-neighbor.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-600 text-[11px] font-bold flex items-center justify-center">3</span>
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-800">Chat Layer</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-indigo-700">ChatRoom.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">MessageComposer.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-cyan-700">conversation.actions.ts</div>
                </div>
                <p className="text-xs text-slate-500">
                  Real-time via <code className="bg-white/50 px-1 rounded">Supabase channels</code>. DMs auto-created with <code className="bg-white/50 px-1 rounded">getOrCreateDM()</code>. Cursor-based pagination for message history.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-pink-500/15 text-pink-600 text-[11px] font-bold flex items-center justify-center">4</span>
                  <MapPin className="w-3.5 h-3.5 text-pink-600" />
                  <p className="text-sm font-semibold text-slate-800">Spatial Layer</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-pink-700">realtimeroom.actions.ts</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-rose-700">RoomCanvasForm.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-amber-700">stack.actions.ts</div>
                </div>
                <p className="text-xs text-slate-500">
                  Posts at (x, y) with <code className="bg-white/50 px-1 rounded">RealtimePost</code>. Edges via <code className="bg-white/50 px-1 rounded">RealtimeEdge</code>. Stacks for curated collections with collaborators.
                </p>
              </div>
            </div>
          </section>

          {/* Key files reference */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Key Files</h2>
              <p className="text-sm text-slate-500 mt-0.5">Primary components, pages, and server actions for the social platform layer.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y">
              {[
                { tag: "Component", path: "components/shared/RealtimeFeed.tsx", desc: "Infinite scroll feed with Supabase realtime" },
                { tag: "Component", path: "components/cards/PostCard.tsx", desc: "Universal post renderer — 17+ type-specific sections" },
                { tag: "Component", path: "components/forms/CreateFeedPost.tsx", desc: "Post creation with type selector & modals" },
                { tag: "Component", path: "components/shared/ProfileHeader.tsx", desc: "Profile header with avatar, bio, action buttons" },
                { tag: "Component", path: "components/buttons/FollowButton.tsx", desc: "Follow / Following / Friends state button" },
                { tag: "Action", path: "lib/actions/feed.actions.ts", desc: "createFeedPost(), fetchFeedPosts()" },
                { tag: "Action", path: "lib/actions/follow.actions.ts", desc: "followUser(), unfollowUser(), areFriends()" },
                { tag: "Action", path: "lib/actions/conversation.actions.ts", desc: "getOrCreateDM(), createGroupConversation()" },
                { tag: "Action", path: "lib/actions/message.actions.ts", desc: "sendMessage(), fetchMessages() (cursor-based)" },
                { tag: "Action", path: "lib/actions/realtimeroom.actions.ts", desc: "fetchRealtimeRoom(), joinRoom()" },
                { tag: "Page", path: "app/(root)/(standard)/page.tsx", desc: "Main feed page (global feed)" },
                { tag: "Page", path: "app/(root)/(standard)/profile/[id]/page.tsx", desc: "User profile page with tabs" },
                { tag: "Page", path: "app/(root)/(standard)/profile/messages/page.tsx", desc: "Conversation inbox" },
                { tag: "Type", path: "lib/types/post.ts", desc: "BasePost interface, post type definitions" },
              ].map((file, i) => {
                const tagColors: Record<string, string> = {
                  Component: "bg-violet-100 text-violet-700",
                  Action: "bg-emerald-100 text-emerald-700",
                  Page: "bg-indigo-100 text-indigo-700",
                  Type: "bg-amber-100 text-amber-700",
                };
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${tagColors[file.tag]}`}>{file.tag}</span>
                    <code className="font-mono text-xs text-slate-700 flex-1 truncate">{file.path}</code>
                    <span className="text-xs text-slate-400 hidden md:block truncate max-w-[40%] text-right">{file.desc}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <footer className="py-6 border-t border-slate-900/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-500">Mesh — Social Platform Layer</span>
            <div className="flex items-center gap-3">
              <a href="/test/deliberation-features" className="text-indigo-500 hover:underline">Deliberation demo →</a>
              <span className="text-slate-300">·</span>
              <a href="/test/embeddable-widget-phase2" className="text-indigo-500 hover:underline">Embed demo →</a>
              <span className="text-slate-300">·</span>
              <span>April 2026</span>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
