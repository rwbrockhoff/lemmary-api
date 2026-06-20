import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiTags } from '../../openapi/tags.js';
import {
	handleShopifyConnect,
	handleShopifyCallback,
} from './shopify-controller.js';

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

const ShopifyConnectQuerySchema = z.object({
	shop: z.string().regex(SHOP_DOMAIN, 'Must be a valid myshopify.com domain'),
});

const ShopifyCallbackQuerySchema = z.object({
	code: z.string(),
	shop: z.string().regex(SHOP_DOMAIN, 'Must be a valid myshopify.com domain'),
	state: z.string(),
	hmac: z.string(),
});

export async function shopifyRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/auth/shopify/connect',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Start the Shopify OAuth connect flow',
				querystring: ShopifyConnectQuerySchema,
			},
		},
		handleShopifyConnect,
	);

	r.get(
		'/auth/shopify/callback',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Shopify OAuth callback',
				querystring: ShopifyCallbackQuerySchema,
			},
		},
		handleShopifyCallback,
	);
}
