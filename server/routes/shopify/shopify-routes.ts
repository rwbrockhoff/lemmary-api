import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ApiTags } from '../../openapi/tags.js';
import {
	handleShopifyStart,
	handleShopifyInstall,
	handleShopifyCallback,
} from './shopify-controller.js';

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

const ShopifyInstallQuerySchema = z.object({
	shop: z.string().regex(SHOP_DOMAIN, 'Must be a valid myshopify.com domain'),
	hmac: z.string(),
	host: z.string().optional(),
	timestamp: z.string().optional(),
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
		'/auth/shopify/start',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Hand off to Shopify to install the app',
			},
		},
		handleShopifyStart,
	);

	r.get(
		'/auth/shopify/install',
		{
			schema: {
				tags: [ApiTags.STORE],
				summary: 'Shopify install entry, starts the OAuth flow',
				querystring: ShopifyInstallQuerySchema,
			},
		},
		handleShopifyInstall,
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
