import { z } from 'zod';

const ProductSchema = z.object({
	id: z.string(),
	store_id: z.string(),
	platform_product_id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	slug: z.string().nullable(),
	is_visible: z.boolean(),
	image_url: z.string().nullable(),
	product_url: z.string().nullable(),
	created_at: z.date(),
	updated_at: z.date(),
});

const ProductVariantSchema = z.object({
	id: z.string(),
	product_id: z.string(),
	platform_variant_id: z.string(),
	platform_sku: z.string().nullable(),
	name: z.string(),
	price: z.string().nullable(),
	sale_price: z.string().nullable(),
	on_sale: z.boolean(),
	stock_quantity: z.number().nullable(),
	stock_unlimited: z.boolean(),
	image_url: z.string().nullable(),
	created_at: z.date(),
	updated_at: z.date(),
});

const ProductSummarySchema = ProductSchema.extend({
	variant_count: z.number(),
	variants: z.array(ProductVariantSchema),
});

export const ProductDetailSchema = ProductSchema.extend({
	variants: z.array(ProductVariantSchema.extend({ bom_item_count: z.number() })),
});

export const GetProductsResponseSchema = z.object({
	products: z.array(ProductSummarySchema),
	lastSyncedAt: z.date().nullable(),
});

export const SyncProductsResponseSchema = z.object({
	synced: z.number(),
	storeId: z.string(),
});

export const ProductIdParamSchema = z.object({
	productId: z.uuid(),
});
