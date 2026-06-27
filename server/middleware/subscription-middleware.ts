import type { FastifyRequest, FastifyReply } from 'fastify';
import { paymentRequired } from '../utils/api-responses.js';
import { hasAppAccess } from '../routes/subscription/subscription-service.js';

// Open routes so a merchant can sign in, connect a store, and subscribe
const OPEN_PREFIXES = [
	'/health',
	'/auth',
	'/store',
	'/subscription',
	'/webhooks/shopify',
	'/webhooks/stripe',
];

function isOpenPath(url: string): boolean {
	const path = url.split('?')[0];
	return OPEN_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`),
	);
}

// Billing gate for feature routes
export async function subscriptionGate(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	if (isOpenPath(request.url)) return;
	if (!request.userId) return;

	const allowed = await hasAppAccess(request.userId);
	if (!allowed) return paymentRequired(reply);
}
