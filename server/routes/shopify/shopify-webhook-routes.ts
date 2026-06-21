import type { FastifyInstance } from 'fastify';
import rawBody from 'fastify-raw-body';
import { verifyWebhookHmac } from './shopify-webhook-service.js';
import {
	SHOPIFY_WEBHOOK_HMAC_HEADER,
	SHOPIFY_WEBHOOK_PATHS,
} from './shopify-config.js';
import {
	handleShopRedact,
	handleCustomersRedact,
	handleCustomersDataRequest,
	handleAppSubscriptionUpdate,
	handleAppUninstalled,
} from './shopify-webhook-controller.js';

export async function shopifyWebhookRoutes(app: FastifyInstance) {
	// Capture the raw body so we can check Shopify's signature against exact bytes
	// Opts in per route with config.rawBody
	// Default parser still fills request.body
	await app.register(rawBody, { global: false, encoding: 'utf8' });

	// HMAC check is these routes auth, since Shopify calls them unauthenticated
	app.addHook('preHandler', async (request, reply) => {
		const hmac = request.headers[SHOPIFY_WEBHOOK_HMAC_HEADER];
		const valid = verifyWebhookHmac(
			request.rawBody ?? '',
			typeof hmac === 'string' ? hmac : undefined,
		);

		if (!valid) {
			return reply.code(401).send({ error: 'Invalid webhook signature' });
		}
	});

	const webhookOptions = { config: { rawBody: true }, schema: { hide: true } };

	app.post(SHOPIFY_WEBHOOK_PATHS.shopRedact, webhookOptions, handleShopRedact);
	app.post(
		SHOPIFY_WEBHOOK_PATHS.customersRedact,
		webhookOptions,
		handleCustomersRedact,
	);
	app.post(
		SHOPIFY_WEBHOOK_PATHS.customersDataRequest,
		webhookOptions,
		handleCustomersDataRequest,
	);
	app.post(
		SHOPIFY_WEBHOOK_PATHS.appSubscriptionsUpdate,
		webhookOptions,
		handleAppSubscriptionUpdate,
	);
	app.post(
		SHOPIFY_WEBHOOK_PATHS.appUninstalled,
		webhookOptions,
		handleAppUninstalled,
	);
}
