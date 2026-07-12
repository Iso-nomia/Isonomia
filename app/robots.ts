/**
 * Phase 3.3 \u2014 robots.txt for the public argument graph.
 *
 * Allow rules:
 *   - /about, /docs      public, login-free explanation of the project
 *   - /llms.txt, /llms-full.txt  LLM discovery files at the site root
 *   - /a/*               public argument permalinks (the citation unit)
 *   - /c/*               public claims by canonical MOID
 *   - /search/arguments  the consumer search surface
 *   - /api/v3/search/    so LLM agents discovering via the OpenAPI spec
 *                        can hit the JSON endpoint directly
 *   - /api/a/.../aif     attestation/jsonld/aif representations
 *   - /api/c/            claim JSON
 *   - /.well-known/      argument-graph manifest + llms.txt
 *
 * Disallow rules:
 *   - /api/*             everything else under /api (auth, internal, etc.)
 *   - /test/*            implementation-test scratch pages
 *   - /quick             personal compose surface
 *
 * AI crawlers: OAI-SearchBot, GPTBot, ClaudeBot/anthropic-ai,
 * Google-Extended, CCBot, and PerplexityBot get the same public surface
 * as everyone else — the corpus ships under CC-BY 4.0. Auth, admin,
 * cron, and internal routes stay disallowed for all agents.
 *
 * Sitemap pointer: emitted so crawlers (including Bing) discover the
 * sitemap without webmaster-tools registration.
 */
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

// Public surfaces every crawler (search + LLM) should be able to reach.
const ALLOW = [
  "/",
  "/about",
  "/docs",
  "/docs/",
  "/llms.txt",
  "/llms-full.txt",
  "/a/",
  "/c/",
  "/search/arguments",
  "/api/v3/search/",
  // Match all /api/a/{shortCode}/aif representations.
  "/api/a/",
  "/api/c/",
  "/.well-known/",
];

const DISALLOW = [
  "/api/auth/",
  "/api/_cron/",
  "/api/internal/",
  "/api/admin/",
  "/test/",
  "/quick",
  // App-shell internals that aren't meant to be discovered.
  "/inbox",
  "/settings",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ALLOW,
        disallow: DISALLOW,
      },
      // OpenAI ChatGPT-search visibility crawler. Same public surface as
      // everyone else. (Independent of GPTBot, which is training-only.)
      {
        userAgent: "OAI-SearchBot",
        allow: ALLOW,
        disallow: DISALLOW,
      },
      // OpenAI training crawler. Allowed on the public corpus, which ships
      // under CC-BY 4.0; the same disallow list keeps auth/admin/internal out.
      {
        userAgent: "GPTBot",
        allow: ALLOW,
        disallow: DISALLOW,
      },
      // Anthropic Claude crawlers.
      {
        userAgent: ["ClaudeBot", "anthropic-ai"],
        allow: ALLOW,
        disallow: DISALLOW,
      },
      // Google's AI extension crawler (Gemini / Vertex).
      {
        userAgent: "Google-Extended",
        allow: ALLOW,
        disallow: DISALLOW,
      },
      // Common Crawl (feeds many downstream LLM datasets).
      {
        userAgent: "CCBot",
        allow: ALLOW,
        disallow: DISALLOW,
      },
      // Perplexity.
      {
        userAgent: "PerplexityBot",
        allow: ALLOW,
        disallow: DISALLOW,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
