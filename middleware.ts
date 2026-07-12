// middleware.ts
import { NextResponse } from "next/server";
import {
  authMiddleware,
  redirectToHome,
  redirectToLogin,
} from "next-firebase-auth-edge";
import { firebaseConfig, serverConfig } from "@/lib/firebase/config";

const PUBLIC_PATHS = ["/register", "/login", "/reset-password", "/room/global"];


const PUBLIC_API = [
    /^\/api\/evidentialdev\//,         
  /^\/api\/events$/,
  /^\/api\/agora\/events/,
  /^\/api\/auth\/extension-token$/,
  // Public argument/claim permalink + AIF endpoints (Track A.1).
  // Crawlers, LLM agents, and oEmbed consumers need unauthenticated access.
  /^\/api\/a\/[^/]+(\/.*)?$/,
  /^\/api\/c\/[^/]+(\/.*)?$/,
  // Public argument-chain machine-citable surface (PUBLIC_CHAIN_PAGE_SPEC).
  // Route returns only `isPublic` chains; 404 otherwise.
  /^\/api\/chains\/[^/]+(\/.*)?$/,
  /^\/api\/og\/argument\//,
  /^\/api\/og\/claim\//,
  /^\/api\/oembed/,
  // Track B.2 \u2014 public read APIs surfaced via MCP / external retrieval.
  /^\/api\/v3\/search\/arguments(\/.*)?$/,
  // Track AI-EPI Pt. 4 — deliberation-scope read APIs (fingerprint,
  // contested frontier, missing moves, chains, synthetic readout,
  // cross-context). Public, cache-friendly; route handlers do their
  // own per-deliberation visibility checks where needed.
  /^\/api\/v3\/deliberations\/[^/]+\/(fingerprint|frontier|missing-moves|chains|synthetic-readout|cross-context)\/?$/,
  // Ludics-substrate surfaces consumed by the @app/isonomia-mcp tools
  // (Cluster F deliberation reads + Cluster A exposure map). Route
  // handlers perform their own per-deliberation visibility checks.
  /^\/api\/v3\/deliberations\/[^/]+\/(ludics-schema|behaviour-at-locus|exposure-map|bindable-moves)\/?$/,
  // Cluster B — articulation lattice reads on behaviours/designs.
  /^\/api\/v3\/behaviours\/[^/]+\/(articulation-lattice|minimal-incarnations|substitute-premises)\/?$/,
  /^\/api\/v3\/designs\/[^/]+\/equivalent-articulations\/?$/,
  // Cluster B writes (compress / join). The route's own JWT-or-token
  // check is the actual auth gate; middleware only needs to let the
  // request reach the handler.
  /^\/api\/v3\/articulations\/(compress|join)\/?$/,
  // Cluster C/D/E — witness reads and the scoped-JWT-gated writes.
  // bind-witness / propose-synthesis enforce WS-3 scoped JWT inside
  // the route; the read endpoints either accept a scoped JWT or are
  // intentionally public (T4 non-attribution).
  /^\/api\/v3\/ludics\/(witnesses|unwitnessed-exposure|instantiation|fossil-record|bind-witness|propose-synthesis|retract-witness)\/?$/,
  // Phase 6 — public stance retrieval per claim MOID.
  /^\/api\/v3\/claims\/[^/]+\/stances\/?$/,
  // Citation resolution endpoints consumed by the MCP write seam.
  /^\/api\/citations\/(resolve-url|resolve\/bulk)\/?$/,
  // Quick-argument write seams (route enforces bearer / session).
  /^\/api\/arguments\/quick(-structured)?\/?$/,
  // Chain-creation write seam for the MCP `propose_argument_chain` tool
  // (route enforces bearer / session).
  /^\/api\/argument-chains\/quick-chain\/?$/,
  // CQ-answer write seam for the MCP `answer_critical_question` tool
  // (route enforces bearer / session; self-canonicalisation is server-gated).
  /^\/api\/cqs\/answer\/?$/,
  // CQ-challenge write seam for the MCP `challenge_critical_question` tool
  // (route enforces bearer / session; status flip is server-gated).
  /^\/api\/cqs\/challenge\/?$/,
  // Freestanding-attack write seam for the MCP `attack_argument` tool
  // (route enforces bearer / session). Matches ONLY /api/ca — the
  // /api/ca/[id]/ratify + /retract sub-routes stay cookie-gated because
  // ratification is human-only (mcp-bot is refused there).
  /^\/api\/ca\/?$/,
  // Protocol dialogue-move write seam for the MCP `post_dialogue_move` tool
  // (route enforces bearer / session; legal-move gated, side-namespaced).
  /^\/api\/dialogue\/move\/?$/,
  // Track B.3 — public OpenAPI 3.1 spec + Scalar-rendered docs page.
  /^\/api\/v3\/openapi\.json$/,
  /^\/api\/v3\/docs\/?$/,
  // MCP read primer for the structured-argument write tools.
  // Returns the argumentation-scheme catalog — read-only, no PII.
  // Required so `list_schemes` works without a bearer token.
  /^\/api\/schemes\/?$/,
  // Phase C — verifier structural-radar read tools (key-addressed GET):
  // verify_scheme_equality, compute_scheme_fingerprint,
  // find_behaviourally_similar_schemes. Read-only, no PII.
  /^\/api\/schemes\/verify-equality\/?$/,
  /^\/api\/schemes\/fingerprint\/?$/,
  /^\/api\/schemes\/similar\/?$/,
  // Phase D — provenance read tools (key-addressed GET):
  // get_scheme_provenance, compare_scheme_provenance. Read-only, no PII.
  /^\/api\/schemes\/provenance\/?$/,
  /^\/api\/schemes\/compare-provenance\/?$/,
  // Ludics-compile write seam for the MCP `compile_deliberation` tool
  // (route enforces bearer / session + rl:mcp_compile). Matches ONLY
  // /api/ludics/compile; other /api/ludics/* stay under their own gates.
  /^\/api\/ludics\/compile\/?$/,
  // Public contact form on the marketing landing page. Honeypot- and
  // validation-gated in the route handler; sends via SES.
  /^\/api\/contact\/?$/,
  ];

// Public pages that must be reachable without auth (Phase 1 of the
// embeddable-widget roadmap + Track A of the AI-epistemic-infrastructure
// roadmap). These are the human-readable counterparts of PUBLIC_API.
const PUBLIC_PAGES_RX = [
  // The homepage itself renders a public marketing landing for logged-out
  // visitors (the page component shows the feed for authed users). Kept
  // public so `/` is crawlable instead of hard-redirecting to /login.
  /^\/$/,
  /^\/a\/[^/]+\/?$/,
  /^\/c\/[^/]+\/?$/,
  // Public, login-free explanation pages (discoverability roadmap):
  // the human-readable About + Docs surface crawlers and LLMs land on
  // before any permalink.
  /^\/about\/?$/,
  /^\/docs(\/[^?]*)?\/?$/,
  // Public argument-chain page (PUBLIC_CHAIN_PAGE_SPEC). Server component
  // renders the empty state for private/missing chains, so anonymous GETs
  // are safe to let through.
  /^\/chains\/[^/]+\/?$/,
  /^\/embed\//,
];

function isApPath(pathname: string) {
  if (pathname === "/.well-known/webfinger") return true;
  if (pathname === "/inbox") return true; // shared inbox (optional)
  if (/^\/users\/[^/]+(\/(inbox|outbox|followers|following))?$/.test(pathname)) return true;
  return false;
}

// Track B.1 — public LLM/agent discovery surfaces.
function isPublicWellKnown(pathname: string) {
  return (
    pathname === "/.well-known/llms.txt" ||
    pathname === "/.well-known/argument-graph"
  );
}

function isApNegotiation(req: Request) {
  const sp = new URL(req.url).searchParams;
  if (sp.has("__ap")) return true;
  const accept = (req.headers.get("accept") || "").toLowerCase();
  const ctype  = (req.headers.get("content-type") || "").toLowerCase();
  const apJson = accept.includes("application/activity+json") || accept.includes("application/ld+json");
  const apPost = ctype.includes("application/activity+json") || ctype.includes("application/ld+json");
  return apJson || apPost;
}

export async function middleware(req: Request) {
  const { pathname } = new URL(req.url);
  if (isPublicWellKnown(pathname)) {
    return NextResponse.next();
  }
  if (PUBLIC_API.some((rx) => rx.test(pathname))) {
    return NextResponse.next();
  }
  if (PUBLIC_PAGES_RX.some((rx) => rx.test(pathname))) {
    return NextResponse.next();
  }
  // Bearer-token API requests bypass cookie middleware. Route handlers are
  // responsible for verifying the token (getCurrentUserId / getCurrentUserAuthId
  // already do this). This unblocks server-to-server clients (Chrome
  // extension, experiment orchestrator bots, MCP) that don't carry the
  // __session cookie. Routes that need auth must enforce it themselves.
  //
  // EXCEPTION: the login/logout paths are handled by next-firebase-auth-edge's
  // authMiddleware itself (there are no physical route handlers for them). The
  // login request intentionally carries `Authorization: Bearer <idToken>` so the
  // middleware can mint the __session cookie — so it must NOT be short-circuited
  // here, otherwise it falls through to Next routing and 404s.
  if (
    pathname.startsWith("/api/") &&
    pathname !== "/api/login" &&
    pathname !== "/api/logout"
  ) {
    const authz = req.headers.get("authorization") || "";
    if (/^Bearer\s+/i.test(authz)) {
      return NextResponse.next();
    }
  }
  const res = NextResponse.next();
  // set cookies here (not in config)
  res.cookies.set({
    name: "mesh.sid",
    value: "placeholder",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  // 0) Preflight/head pass through
  if (req.method === "OPTIONS" || req.method === "HEAD") {
    return NextResponse.next();
  }

  // 1) Skip static/public assets
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon-alt.ico" ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/opensearch.xml" ||
    // Root-level LLM discovery files (public/llms.txt, public/llms-full.txt).
    pathname === "/llms.txt" ||
    pathname === "/llms-full.txt"
  ) {
    return NextResponse.next();
  }

  // 2) Skip ALL api routes (any depth) to avoid recursion
  // if (pathname === "/api" || pathname.includes("/api/")) {
  //   return NextResponse.next();
  // }

  // 3) Other explicit allowlists
  if (pathname === "/.well-known/webfinger") return NextResponse.next();
  if (isPublicWellKnown(pathname)) return NextResponse.next();
  if (isApPath(pathname) && isApNegotiation(req)) return NextResponse.next();

  // Treat the incoming object as NextRequest at call sites (runtime it already is)
  const request = req as any;

  // 4) Auth gate for everything else
  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    apiKey: firebaseConfig.apiKey,
    cookieName: "__session",
    cookieSignatureKeys: serverConfig.cookieSignatureKeys,
    cookieSerializeOptions: {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 12 * 60 * 60 * 24,
    },
    serviceAccount: serverConfig.serviceAccount,
    handleValidToken: async (_ctx, headers) => {
      // Block auth'd users from auth pages (except /room/global)
      if (PUBLIC_PATHS.includes(pathname) && pathname !== "/room/global") {
        return redirectToHome(request);
      }

      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async (reason) => {
      console.info("Missing or malformed credentials", { reason });
      return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
    },
    handleError: async (error) => {
      console.error("Unhandled authentication error", { error });
      return redirectToLogin(request, { path: "/login", publicPaths: PUBLIC_PATHS });
    },
  });
}

// Only keep supported fields here
export const config = {
  matcher: [
    "/.well-known/:path*",
    "/api/proposals/:path*",  // ← add this
    "/api/discussions/:path*",
    "/api/messages/:path*",
    "/api/conversations/:path*",
    "/api/drifts/:path*",            // 👈 add this
    "/api/me",                        // 👈 and this
    "/api/sheaf/:path*",
    "/discussions/:path*",
    "/messages/:path*",
    '/((?!_next/static|_next/image|favicon.ico|favicon-alt.ico).*)',
    '/api/ludics/:path*',
    '/api/commitments/:path*',
    '/api/compose/:path*',
    '/api/loci/:path*',
    '/api/:path*',
    "/((?!_next|favicon.ico|favicon-alt.ico|fonts|images|assets|.*\\.).+)",
  ],
};
