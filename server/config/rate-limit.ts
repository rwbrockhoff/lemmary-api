import type { FastifyRequest } from 'fastify';

export const GLOBAL_RATE_LIMIT = { max: 200, timeWindow: '1 minute' };
export const AUTH_RATE_LIMIT = { max: 10, timeWindow: '15 minutes' };
export const SYNC_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

// Health checks and Shopify webhooks skip rate limiting
export const skipRateLimit = (req: FastifyRequest): boolean =>
	req.url === '/health' || req.url.startsWith('/webhooks/shopify');
