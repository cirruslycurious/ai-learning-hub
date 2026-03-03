/**
 * Authorizer cache TTL in seconds.
 * Used by CDK api-gateway.stack.ts for the JWT authorizer's resultsCacheTtl.
 * The API Key authorizer intentionally uses TTL=0 (caching disabled).
 */
export const AUTHORIZER_CACHE_TTL = 300;
