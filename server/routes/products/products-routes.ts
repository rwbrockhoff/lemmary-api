import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import { SYNC_RATE_LIMIT } from '../../config/rate-limit.js';
import {
	GetProductsResponseSchema,
	ProductDetailSchema,
	SyncProductsResponseSchema,
	ProductIdParamSchema,
} from './contract/schemas.js';
import {
	handleSyncProducts,
	handleGetProducts,
	handleGetProduct,
} from './products-controller.js';

export async function productsRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.post(
		'/products/sync',
		{
			config: { rateLimit: SYNC_RATE_LIMIT },
			schema: {
				tags: [ApiTags.PRODUCTS],
				summary: 'Sync products from the connected platform',
				response: {
					200: successSchema(SyncProductsResponseSchema),
				},
			},
		},
		handleSyncProducts,
	);

	r.get(
		'/products',
		{
			schema: {
				tags: [ApiTags.PRODUCTS],
				summary: 'List products with variants',
				response: {
					200: successSchema(GetProductsResponseSchema),
				},
			},
		},
		handleGetProducts,
	);

	r.get(
		'/products/:productId',
		{
			schema: {
				tags: [ApiTags.PRODUCTS],
				summary: 'Get a product with variants',
				params: ProductIdParamSchema,
				response: {
					200: successSchema(ProductDetailSchema),
				},
			},
		},
		handleGetProduct,
	);
}
