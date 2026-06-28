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
	VariantParamSchema,
	UpdateProductionTypeSchema,
	UpdateVariantResponseSchema,
	BulkProductionTypeResponseSchema,
} from './contract/schemas.js';
import {
	handleSyncProducts,
	handleGetProducts,
	handleGetProduct,
	handleUpdateVariantProductionType,
	handleUpdateProductProductionType,
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

	r.patch(
		'/products/:productId/variants/:variantId',
		{
			schema: {
				tags: [ApiTags.PRODUCTS],
				summary: 'Update a variant production type',
				params: VariantParamSchema,
				body: UpdateProductionTypeSchema,
				response: {
					200: successSchema(UpdateVariantResponseSchema),
				},
			},
		},
		handleUpdateVariantProductionType,
	);

	r.patch(
		'/products/:productId/variants',
		{
			schema: {
				tags: [ApiTags.PRODUCTS],
				summary: 'Set production type for all variants of a product',
				params: ProductIdParamSchema,
				body: UpdateProductionTypeSchema,
				response: {
					200: successSchema(BulkProductionTypeResponseSchema),
				},
			},
		},
		handleUpdateProductProductionType,
	);
}
