# Isonomia

**Epistemic infrastructure for distributed knowledge production.**

Isonomia is open-source infrastructure that unifies a general-purpose social
platform with a formal deliberation engine under a single data model. Any
conversation can be upgraded to a tracked deliberation through one reversible
action, and every resulting claim, argument, and deliberation is addressable,
citable, challengeable, and durable.

No behavioral tracking. No algorithmic ranking. No engagement metrics. Data
ownership, privacy, and provenance are enforced by architecture, not policy.

---

## Two layers, one data model

**Social layer (MESH)** — a complete standalone community platform: a
chronological feed with eight post types, profiles and follows, persistent rooms
and lounges, spatial canvas environments, sheaf-based layered messaging, proposals
and polls, long-form articles with anchored comments, and shared document
libraries.

**Reasoning layer (Isonomia)** — formal deliberation that sits beside the social
layer and is reachable from any point in it:

- **Structured argumentation** — ASPIC+ grounded extensions with the Walton
  taxonomy of schemes and auto-generated critical questions.
- **Proof theory** — Ludics designs over a generative substrate of witnessing
  records, articulation lattices, and fossil retractions.
- **Typed dialogue** — protocol-enforced dialogue moves (challenge, ground,
  concede, retract) with commitment stores.
- **Evidence & confidence** — a category-theoretic evidence algebra folding
  confidence over a lawful log-odds semiring, fed by a six-stage citation
  resolver (arXiv, Crossref, page metadata, OpenAlex, LLM extraction, Wayback).
- **Plexus** — a cross-room transport network connecting deliberations as a
  graph-of-graphs with fingerprinted provenance and confidence gating.

The argument graph is exposed as a machine-citable primitive: every permalink
resolves to a content-hashed, dialectically attested argument served over
content-negotiated HTTP (HTML, JSON-LD, AIF, oEmbed, embeds) and a bidirectional
Model Context Protocol surface.

---

## Tech stack

- **Frontend** — Next.js 14 (App Router), React 18, TypeScript, Tailwind
- **Backend** — Node 18, Prisma, PostgreSQL, Redis
- **Workers** — BullMQ background jobs (confidence decay, re-embedding, source
  verification, knowledge-graph build)
- **ML services** — Python 3.11 microservices (embedding, ranking, explanation)
- **Formal core** — TypeScript engines with Agda mechanisations of key results

## Repository layout

```
app/          Next.js App Router routes and API handlers (app/api/**/route.ts)
components/    React UI
lib/           Domain logic by subsystem (aspic/, ludics/, dialogue/, aif/, …)
packages/      Workspaces (@app/sheaf-acl, ludics-core, aif-core, dialogue, …)
workers/       Background jobs
services/      Python microservices
RESEARCH_PROGRAMME/  Agda mechanisations and formal notes
```

## Getting started

Requires Node 18+ and a PostgreSQL database.

```bash
yarn install            # installs deps; builds @app/sheaf-acl workspace
cp .env.example .env    # fill in your own values
yarn dev                # Next dev server
```

Common scripts:

```bash
yarn build              # production build
yarn lint               # next lint
yarn test               # jest unit tests
yarn worker             # start background workers
```

The Prisma schema lives at `lib/models/schema.prisma`; apply it with
`npx prisma db push`.

## License

Released under the [MIT License](LICENSE).
