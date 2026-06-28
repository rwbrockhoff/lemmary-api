import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import {
	getStoreForUser,
	getStoreWithAccessToken,
	getShopDomain,
	type StoreWithAccessToken,
} from '../../utils/store.js';
import { fetchSquarespaceProducts } from './platforms/squarespace.js';
import { fetchShopifyProducts } from './platforms/shopify.js';
import { ensureFreshShopifyToken } from '../shopify/shopify-token.js';
import type { NormalizedProduct } from './platforms/product-types.js';
import type { ProductionType } from '../../db/enums.js';

async function fetchProductsFromPlatform(
	store: StoreWithAccessToken,
): Promise<NormalizedProduct[]> {
	if (store.platform === 'squarespace') {
		return fetchSquarespaceProducts(store.access_token);
	}

	if (store.platform === 'shopify') {
		const token = await ensureFreshShopifyToken(store);
		return fetchShopifyProducts(getShopDomain(store), token);
	}

	throw new Error(`Unsupported platform: ${store.platform}`);
}

async function upsertProducts(storeId: string, products: NormalizedProduct[]) {
	return db.transaction().execute(async (trx) => {
		let synced = 0;

		for (const { product, variants } of products) {
			const result = await trx
				.insertInto('products')
				.values({
					...product,
					store_id: storeId,
				})
				.onConflict((oc) =>
					oc.columns(['store_id', 'platform_product_id']).doUpdateSet({
						name: product.name,
						description: product.description,
						slug: product.slug,
						is_visible: product.is_visible,
						image_url: product.image_url,
						product_url: product.product_url,
						updated_at: sql`NOW()`,
					}),
				)
				.returning('id')
				.executeTakeFirstOrThrow();

			if (variants.length > 0) {
				await trx
					.insertInto('product_variants')
					.values(
						variants.map((variant) => ({
							...variant,
							product_id: result.id,
						})),
					)
					.onConflict((oc) =>
						// production_type is user-set, keep it out of whitelist so syncs don't reset value
						oc.columns(['product_id', 'platform_variant_id']).doUpdateSet({
							platform_sku: (eb) => eb.ref('excluded.platform_sku'),
							name: (eb) => eb.ref('excluded.name'),
							price: (eb) => eb.ref('excluded.price'),
							sale_price: (eb) => eb.ref('excluded.sale_price'),
							on_sale: (eb) => eb.ref('excluded.on_sale'),
							stock_quantity: (eb) => eb.ref('excluded.stock_quantity'),
							stock_unlimited: (eb) => eb.ref('excluded.stock_unlimited'),
							image_url: (eb) => eb.ref('excluded.image_url'),
							updated_at: sql`NOW()`,
						}),
					)
					.execute();
			}

			synced++;
		}

		return synced;
	});
}

export async function syncProducts(userId: string) {
	const store = await getStoreWithAccessToken(userId);
	if (!store) return null;
	const products = await fetchProductsFromPlatform(store);
	const synced = await upsertProducts(store.id, products);

	await db
		.updateTable('stores')
		.set({ last_synced_at: new Date() })
		.where('id', '=', store.id)
		.execute();

	return { synced, storeId: store.id };
}

export async function getProducts(userId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return { products: [], lastSyncedAt: null };

	const products = await db
		.selectFrom('products')
		.selectAll('products')
		.where('products.store_id', '=', store.id)
		.orderBy('products.is_visible', 'desc')
		.orderBy('products.name', 'asc')
		.execute();

	const productIds = products.map((p) => p.id);

	const variants =
		productIds.length > 0
			? await db
					.selectFrom('product_variants')
					.selectAll()
					.where('product_id', 'in', productIds)
					.orderBy('name', 'asc')
					.execute()
			: [];

	const variantsByProduct = new Map<string, typeof variants>();
	for (const variant of variants) {
		const group = variantsByProduct.get(variant.product_id) ?? [];
		group.push(variant);
		variantsByProduct.set(variant.product_id, group);
	}

	return {
		products: products.map((product) => {
			const productVariants = variantsByProduct.get(product.id) ?? [];
			return {
				...product,
				variant_count: productVariants.length,
				variants: productVariants,
			};
		}),
		lastSyncedAt: store.last_synced_at,
	};
}

export async function updateVariantProductionType(
	userId: string,
	productId: string,
	variantId: string,
	productionType: ProductionType,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const updated = await db
		.updateTable('product_variants')
		.set({ production_type: productionType, updated_at: new Date() })
		.where('id', '=', variantId)
		.where('product_id', '=', productId)
		.where('product_id', 'in', (eb) =>
			eb.selectFrom('products').select('id').where('store_id', '=', store.id),
		)
		.returning(['id', 'production_type'])
		.executeTakeFirst();

	return updated ?? null;
}

// Applies production_type in bulk to all variants
export async function updateProductProductionType(
	userId: string,
	productId: string,
	productionType: ProductionType,
): Promise<number | null> {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const product = await db
		.selectFrom('products')
		.select('id')
		.where('id', '=', productId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();
	if (!product) return null;

	const result = await db
		.updateTable('product_variants')
		.set({ production_type: productionType, updated_at: new Date() })
		.where('product_id', '=', productId)
		.executeTakeFirst();

	return Number(result.numUpdatedRows);
}

// Applies production_type to EVERY variant in the store
export async function updateAllProductionTypes(
	userId: string,
	productionType: ProductionType,
): Promise<number | null> {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const result = await db
		.updateTable('product_variants')
		.set({ production_type: productionType, updated_at: new Date() })
		.where('product_id', 'in', (eb) =>
			eb.selectFrom('products').select('id').where('store_id', '=', store.id),
		)
		.executeTakeFirst();

	return Number(result.numUpdatedRows);
}

export async function getProduct(userId: string, productId: string) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const product = await db
		.selectFrom('products')
		.selectAll()
		.where('id', '=', productId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!product) return null;

	const variants = await db
		.selectFrom('product_variants')
		.selectAll()
		.where('product_id', '=', product.id)
		.orderBy('name', 'asc')
		.execute();

	const skus = variants
		.map((v) => v.platform_sku)
		.filter((sku): sku is string => sku !== null);

	const bomCounts =
		skus.length > 0
			? await db
					.selectFrom('bom_items')
					.select(['platform_sku', db.fn.count<number>('id').as('count')])
					.where('store_id', '=', store.id)
					.where('platform_sku', 'in', skus)
					.groupBy('platform_sku')
					.execute()
			: [];

	const countMap = new Map(bomCounts.map((r) => [r.platform_sku, r.count]));

	const variantsWithCounts = variants.map((v) => ({
		...v,
		bom_item_count: v.platform_sku ? (countMap.get(v.platform_sku) ?? 0) : 0,
	}));

	return { ...product, variants: variantsWithCounts };
}
