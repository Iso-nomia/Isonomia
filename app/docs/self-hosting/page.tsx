import type { Metadata } from "next";
import Link from "next/link";
import PublicDocsShell, { JsonLd } from "@/components/public/PublicDocsShell";

export const dynamic = "force-static";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const REPO_URL = "https://github.com/rohan-k-mathur/mesh";
const PATH = "/docs/self-hosting";

export const metadata: Metadata = {
  title: "Self-hosting",
  description:
    "How to deploy and operate your own Isonomia instance: the stack, prerequisites, environment variables, and the build and run steps.",
  alternates: { canonical: `${BASE_URL}${PATH}` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Self-hosting Isonomia",
  description:
    "Deploy and operate your own Isonomia instance: stack, prerequisites, environment, and build/run steps.",
  url: `${BASE_URL}${PATH}`,
  isPartOf: { "@type": "WebSite", name: "Isonomia", url: BASE_URL },
  author: { "@type": "Organization", name: "Isonomia" },
  publisher: { "@type": "Organization", name: "Isonomia" },
  inLanguage: "en",
};

export default function SelfHostingPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <PublicDocsShell
        eyebrow="Docs"
        title="Self-hosting"
        lede="Isonomia is open-source and self-hostable. A community that needs full control over its data can run its own instance."
      >
        <p className="text-sm text-slate-500">
          This is an orientation overview. The authoritative, version-specific
          instructions live in the <a href={REPO_URL}>repository</a> README.
        </p>

        <h2>The stack</h2>
        <ul>
          <li>
            <strong>Front-end:</strong> Next.js 14 (App Router), React 18,
            TypeScript, Tailwind.
          </li>
          <li>
            <strong>Backend:</strong> Node 18+ (TypeScript), Prisma,
            PostgreSQL, Redis.
          </li>
          <li>
            <strong>Data / services:</strong> Supabase (Postgres + type
            generation), Upstash Redis and BullMQ for background jobs, Pinecone
            for vector search.
          </li>
          <li>
            <strong>ML services:</strong> Python 3.11 micro-services deployed via
            Docker.
          </li>
        </ul>

        <h2>Prerequisites</h2>
        <ul>
          <li>Node.js 18 or later.</li>
          <li>A PostgreSQL database (Supabase or self-managed).</li>
          <li>A Redis instance (Upstash or self-managed) for background workers.</li>
          <li>
            Credentials for the integrations you enable — LLM provider (OpenAI /
            DeepSeek), Stripe, Firebase, LiveKit, Supabase, AWS (S3 / KMS / SES),
            and Pinecone are read from environment variables.
          </li>
        </ul>

        <h2>Install and build</h2>
        <p>
          Clone the repository and install dependencies. The workspace package{" "}
          <code>@app/sheaf-acl</code> is built automatically before dev and build:
        </p>
        <pre>
          <code>{`git clone ${REPO_URL}
cd mesh
yarn install

# Development server (runs the sheaf-acl build first)
npm run dev

# Production build and start
npm run build
npm run start`}</code>
        </pre>

        <h2>Database</h2>
        <p>
          Isonomia uses Prisma with a single large schema. Apply it to your
          database with <code>db:push</code> (not <code>migrate dev</code>):
        </p>
        <pre>
          <code>{`# Push the schema to your database
npm run db:push

# Regenerate the Prisma client (also runs automatically on install)
npx prisma generate`}</code>
        </pre>
        <p>
          Supabase type generation requires <code>SUPABASE_PROJECT_ID</code> and{" "}
          <code>SUPABASE_ACCESS_TOKEN</code>.
        </p>

        <h2>Background workers</h2>
        <p>
          Background jobs (confidence decay, re-embedding, source verification and
          archiving, knowledge-graph build, transport aggregation) run in a
          separate worker process that reads <code>.env</code>:
        </p>
        <pre>
          <code>{`npm run worker`}</code>
        </pre>

        <h2>Verify and lint</h2>
        <pre>
          <code>{`npm run lint    # next lint
npm test        # jest unit tests`}</code>
        </pre>

        <h2>More</h2>
        <p>
          For the conceptual model behind what you are hosting, see{" "}
          <Link href="/docs/architecture">Architecture</Link> and the{" "}
          <Link href="/docs/argument-graph">argument graph</Link> documentation.
          For data-handling questions, see <Link href="/docs/privacy">Privacy</Link>.
        </p>
      </PublicDocsShell>
    </>
  );
}
