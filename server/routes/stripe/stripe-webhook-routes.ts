import type { FastifyInstance } from 'fastify';
import rawBody from 'fastify-raw-body';
import { handleStripeWebhook } from './stripe-webhook-controller.js';

export async function stripeWebhookRoutes(app: FastifyInstance) {
	// Stripe checks its signature against the exact bytes, so keep raw body
	await app.register(rawBody, { global: false, encoding: 'utf8' });

	app.post(
		'/webhooks/stripe',
		{ config: { rawBody: true }, schema: { hide: true } },
		handleStripeWebhook,
	);
}
