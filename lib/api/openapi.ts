/**
 * OpenAPI 3.0 Specification for Mesh Evidence API
 *
 * Complete API documentation for the public evidence API.
 *
 * @module lib/api/openapi
 */

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Mesh Evidence API",
    version: "1.0.0",
    description: `
The Mesh Evidence API provides programmatic access to verified sources, research stacks, and evidence data.

## Authentication

All API requests require an API key. Include your key in the Authorization header:

\`\`\`
Authorization: Bearer mesh_pk_...
\`\`\`

Generate API keys in your [account settings](/settings/api-keys).

## Rate Limits

| Tier | Requests/Hour |
|------|---------------|
| Free | 100 |
| Pro | 1,000 |
| Partner | 10,000 |
| Unlimited | No limit |

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Maximum requests per hour
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Unix timestamp when the window resets

## Pagination

List endpoints use cursor-based pagination:
- \`limit\`: Number of results per page (default varies by endpoint)
- \`cursor\`: Cursor for the next page (from previous response)

Response includes:
\`\`\`json
{
  "data": [...],
  "pagination": {
    "hasMore": true,
    "nextCursor": "abc123..."
  }
}
\`\`\`
    `,
    contact: {
      name: "Mesh API Support",
      email: "api@mesh.app",
      url: "https://mesh.app/developers",
    },
    license: {
      name: "API Terms of Service",
      url: "https://mesh.app/terms/api",
    },
  },
  servers: [
    {
      url: "https://mesh.app/api/v1",
      description: "Production",
    },
    ...(process.env.NODE_ENV === "development"
      ? [{ url: "http://localhost:3000/api/v1", description: "Development" }]
      : []),
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description: "API key obtained from Mesh account settings. Format: mesh_pk_...",
      },
    },
    schemas: {
      Source: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unique source identifier" },
          title: { type: "string", description: "Source title" },
          authors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
            description: "List of authors",
          },
          year: { type: "integer", nullable: true, description: "Publication year" },
          publicationDate: { type: "string", format: "date-time", nullable: true },
          doi: { type: "string", nullable: true, description: "Digital Object Identifier" },
          url: { type: "string", nullable: true, description: "Source URL" },
          type: { type: "string", nullable: true, description: "Source type (article, book, website, etc.)" },
          container: { type: "string", nullable: true, description: "Journal or publication name" },
          publisher: { type: "string", nullable: true },
          volume: { type: "string", nullable: true },
          issue: { type: "string", nullable: true },
          pages: { type: "string", nullable: true },
          abstract: { type: "string", nullable: true, description: "Source abstract (may be truncated)" },
          isOpenAccess: { type: "boolean", nullable: true },
          verificationStatus: {
            type: "string",
            enum: ["unverified", "verified", "failed", "pending"],
            description: "URL verification status",
          },
          citationCount: { type: "integer", description: "Number of times cited in Mesh" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      SourceFull: {
        allOf: [
          { $ref: "#/components/schemas/Source" },
          {
            type: "object",
            properties: {
              language: { type: "string", nullable: true },
              pdfUrl: { type: "string", nullable: true },
              verification: {
                type: "object",
                nullable: true,
                properties: {
                  status: { type: "string" },
                  verifiedAt: { type: "string", format: "date-time", nullable: true },
                  score: { type: "number", nullable: true },
                  httpStatus: { type: "integer", nullable: true },
                  lastCheckedAt: { type: "string", format: "date-time", nullable: true },
                },
              },
              citations: {
                type: "array",
                items: { $ref: "#/components/schemas/Citation" },
                description: "Citations using this source (when include=citations)",
              },
              stacks: {
                type: "array",
                items: { $ref: "#/components/schemas/StackSummary" },
                description: "Stacks containing this source (when include=stacks)",
              },
            },
          },
        ],
      },
      Citation: {
        type: "object",
        properties: {
          id: { type: "string" },
          targetId: { type: "string" },
          targetType: { type: "string" },
          intent: { type: "string", nullable: true, description: "Citation intent (supporting, contradicting, etc.)" },
          quote: { type: "string", nullable: true },
          locator: { type: "string", nullable: true, description: "Page number, section, etc." },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Stack: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unique stack identifier" },
          name: { type: "string", description: "Stack name" },
          description: { type: "string", nullable: true },
          visibility: {
            type: "string",
            enum: ["private", "unlisted", "public_open", "public_closed"],
          },
          category: { type: "string", nullable: true },
          tags: { type: "array", items: { type: "string" } },
          owner: { $ref: "#/components/schemas/UserSummary" },
          itemCount: { type: "integer" },
          collaboratorCount: { type: "integer" },
          subscriberCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      StackFull: {
        allOf: [
          { $ref: "#/components/schemas/Stack" },
          {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: { $ref: "#/components/schemas/StackItem" },
                description: "Stack items (when include=items)",
              },
              collaborators: {
                type: "array",
                items: { $ref: "#/components/schemas/Collaborator" },
                description: "Stack collaborators (when include=collaborators)",
              },
            },
          },
        ],
      },
      StackSummary: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          visibility: { type: "string" },
        },
      },
      StackItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          order: { type: "integer" },
          notes: { type: "string", nullable: true },
          source: { $ref: "#/components/schemas/Source" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      UserSummary: {
        type: "object",
        properties: {
          id: { type: "string" },
          username: { type: "string" },
          name: { type: "string", nullable: true },
        },
      },
      Collaborator: {
        type: "object",
        properties: {
          id: { type: "string" },
          role: { type: "string" },
          user: { $ref: "#/components/schemas/UserSummary" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", description: "Error code for programmatic handling" },
              message: { type: "string", description: "Human-readable error message" },
            },
            required: ["code", "message"],
          },
        },
      },
      PaginatedResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: {} },
          pagination: {
            type: "object",
            properties: {
              hasMore: { type: "boolean" },
              nextCursor: { type: "string", nullable: true },
            },
          },
        },
      },
    },
    parameters: {
      limit: {
        name: "limit",
        in: "query",
        description: "Number of results to return",
        schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
      },
      cursor: {
        name: "cursor",
        in: "query",
        description: "Pagination cursor from previous response",
        schema: { type: "string" },
      },
    },
    responses: {
      Unauthorized: {
        description: "API key missing or invalid",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              error: { code: "invalid_api_key", message: "Invalid API key" },
            },
          },
        },
      },
      Forbidden: {
        description: "Insufficient permissions",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              error: { code: "insufficient_scope", message: "Required scope: write:sources" },
            },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              error: { code: "not_found", message: "Source not found" },
            },
          },
        },
      },
      RateLimited: {
        description: "Rate limit exceeded",
        headers: {
          "X-RateLimit-Limit": { schema: { type: "string" } },
          "X-RateLimit-Remaining": { schema: { type: "string" } },
          "X-RateLimit-Reset": { schema: { type: "string" } },
          "Retry-After": { schema: { type: "string" } },
        },
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              error: { code: "rate_limit_exceeded", message: "Rate limit exceeded. Limit: 100 requests per hour." },
            },
          },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  tags: [
    { name: "Sources", description: "Access and search verified sources" },
    { name: "Stacks", description: "Access public research stacks" },
  ],
  paths: {
    "/sources": {
      get: {
        tags: ["Sources"],
        summary: "Search sources",
        description: "Search and filter sources. Returns paginated results.",
        operationId: "searchSources",
        parameters: [
          {
            name: "q",
            in: "query",
            description: "Search query (searches title, abstract, authors)",
            schema: { type: "string" },
          },
          {
            name: "doi",
            in: "query",
            description: "Filter by exact DOI",
            schema: { type: "string" },
          },
          {
            name: "type",
            in: "query",
            description: "Filter by source type",
            schema: { type: "string" },
          },
          {
            name: "verified",
            in: "query",
            description: "Filter by verification status",
            schema: { type: "boolean" },
          },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/cursor" },
        ],
        responses: {
          "200": {
            description: "List of sources",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Source" },
                    },
                    pagination: {
                      type: "object",
                      properties: {
                        hasMore: { type: "boolean" },
                        nextCursor: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/sources/{sourceId}": {
      get: {
        tags: ["Sources"],
        summary: "Get source by ID",
        description: "Retrieve a single source with full details.",
        operationId: "getSource",
        parameters: [
          {
            name: "sourceId",
            in: "path",
            required: true,
            description: "Source ID",
            schema: { type: "string" },
          },
          {
            name: "include",
            in: "query",
            description: "Comma-separated list of relations to include",
            schema: {
              type: "string",
              enum: ["citations", "stacks"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Source details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/SourceFull" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/stacks": {
      get: {
        tags: ["Stacks"],
        summary: "Search stacks",
        description: "Search and filter public stacks. Returns paginated results.",
        operationId: "searchStacks",
        parameters: [
          {
            name: "q",
            in: "query",
            description: "Search query (searches name, description)",
            schema: { type: "string" },
          },
          {
            name: "userId",
            in: "query",
            description: "Filter by owner ID",
            schema: { type: "string" },
          },
          {
            name: "visibility",
            in: "query",
            description: "Filter by visibility",
            schema: {
              type: "string",
              enum: ["public_open", "public_closed", "unlisted"],
            },
          },
          {
            name: "limit",
            in: "query",
            description: "Number of results (max 50)",
            schema: { type: "integer", default: 20, maximum: 50 },
          },
          { $ref: "#/components/parameters/cursor" },
        ],
        responses: {
          "200": {
            description: "List of stacks",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Stack" },
                    },
                    pagination: {
                      type: "object",
                      properties: {
                        hasMore: { type: "boolean" },
                        nextCursor: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/stacks/{stackId}": {
      get: {
        tags: ["Stacks"],
        summary: "Get stack by ID",
        description: "Retrieve a single stack with full details.",
        operationId: "getStack",
        parameters: [
          {
            name: "stackId",
            in: "path",
            required: true,
            description: "Stack ID",
            schema: { type: "string" },
          },
          {
            name: "include",
            in: "query",
            description: "Comma-separated list of relations to include",
            schema: {
              type: "string",
              enum: ["items", "collaborators"],
            },
          },
          {
            name: "itemLimit",
            in: "query",
            description: "Max items to return when include=items (max 200)",
            schema: { type: "integer", default: 50, maximum: 200 },
          },
        ],
        responses: {
          "200": {
            description: "Stack details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/StackFull" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
  },
};

/**
 * Export spec as JSON for API endpoint
 */
export function getOpenApiSpecJson(): string {
  return JSON.stringify(openApiSpec, null, 2);
}
