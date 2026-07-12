/**
 * Public API Module
 *
 * Exports all public API utilities.
 *
 * @module lib/api
 */

// API Key management
export {
  generateApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
  updateApiKey,
  hasScope,
  hasAllScopes,
  API_SCOPES,
  type ApiScope,
  type GeneratedApiKey,
  type ApiKeyValidation,
} from "./keys";

// Rate limiting
export {
  checkRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  rateLimitHeaders,
  TIER_LIMITS,
  type RateLimitResult,
} from "./rateLimit";

// API middleware
export {
  apiMiddleware,
  apiSuccess,
  apiPaginated,
  apiError,
  withApiAuth,
  corsHeaders,
  handleCorsPreFlight,
  type ApiAuthResult,
} from "./middleware";

// OpenAPI specification
export { openApiSpec, getOpenApiSpecJson } from "./openapi";
