import type { Metadata } from "next";

/**
 * /api/v3/docs
 *
 * Track B.3 \u2014 human-rendered API reference, powered by Scalar's
 * standalone bundle. Reads the spec at /api/v3/openapi.json.
 *
 * Inherits the minimal <html>/<body> shell from app/api/layout.tsx so
 * the page is free of Mesh app chrome.
 */

export const metadata: Metadata = {
  title: "Isonomia AI-Citation API \u2014 v3 Reference",
  description:
    "OpenAPI 3.1 reference for the Isonomia AI-citation API: search, argument resolution, claim lookup, attestation envelope, authoring.",
};

const SCALAR_BUNDLE =
  "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.13/dist/browser/standalone.min.js";

export default function ApiDocsPage() {
  const config = {
    theme: "default",
    layout: "modern",
    hideDownloadButton: false,
    metaData: { title: "Isonomia AI-Citation API" },
  };
  return (
    <>
      <noscript>
        <div
          style={{
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, sans-serif",
            padding: 32,
            maxWidth: 720,
            margin: "0 auto",
            color: "#1e293b",
          }}
        >
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>
            Isonomia AI-Citation API \u2014 v3 Reference
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "#475569" }}>
            This page renders the OpenAPI 3.1 spec via Scalar, which
            requires JavaScript. The raw spec is available at{" "}
            <a href="/api/v3/openapi.json">/api/v3/openapi.json</a> and the
            machine-readable discovery manifest is at{" "}
            <a href="/.well-known/argument-graph">
              /.well-known/argument-graph
            </a>
            .
          </p>
        </div>
      </noscript>
      <script
        id="api-reference"
        data-url="/api/v3/openapi.json"
        data-configuration={JSON.stringify(config)}
      />
      <script src={SCALAR_BUNDLE} async />
    </>
  );
}
