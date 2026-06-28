import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import {
	TEST_STORE_ID,
	OTHER_USER_ID,
	OTHER_STORE_ID,
} from '../../tests/test-constants.js';
import { env } from '../../config/environment.js';
import { db } from '../../db/connection.js';

describe('Product production type', () => {
	let app: FastifyInstance;
	let productId: string;
	let variantIds: string[];

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();

		const variants = await db
			.selectFrom('product_variants')
			.innerJoin('products', 'products.id', 'product_variants.product_id')
			.select([
				'product_variants.id as id',
				'product_variants.product_id as product_id',
			])
			.where('products.store_id', '=', TEST_STORE_ID)
			.where('products.name', '=', 'Test Bag')
			.execute();

		productId = variants[0].product_id;
		variantIds = variants.map((v) => v.id);

		// A second store so we can prove a user can't touch another store's variants
		await db
			.insertInto('users')
			.values({
				id: OTHER_USER_ID,
				email: 'other@lemmary.test',
				first_name: 'Other',
				last_name: 'User',
			})
			.execute();

		await db
			.insertInto('stores')
			.values({
				id: OTHER_STORE_ID,
				user_id: OTHER_USER_ID,
				platform: 'squarespace',
				store_name: 'Other Store',
				store_access_token: sql<Buffer>`pgp_sym_encrypt('x', ${env.STORE_ENCRYPTION_KEY})`,
				platform_config: {},
			})
			.execute();
	});

	afterAll(async () => {
		// reset so other test files see seed state
		await db
			.updateTable('product_variants')
			.set({ production_type: 'made_to_order' })
			.where('product_id', 'in', (eb) =>
				eb
					.selectFrom('products')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID),
			)
			.execute();
		await db.deleteFrom('stores').where('id', '=', OTHER_STORE_ID).execute();
		await db.deleteFrom('users').where('id', '=', OTHER_USER_ID).execute();
		await app.close();
	});

	it('updates a single variant production type', async () => {
		const response = await app.inject(
			withAuth('PATCH', `/products/${productId}/variants/${variantIds[0]}`, {
				payload: { productionType: 'made_to_order' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.production_type).toBe('made_to_order');
	});

	it('rejects an invalid production type', async () => {
		const response = await app.inject(
			withAuth('PATCH', `/products/${productId}/variants/${variantIds[0]}`, {
				payload: { productionType: 'nonsense' },
			}),
		);

		expect(response.statusCode).toBe(400);
	});

	it('bulk applies production type to all variants of a product', async () => {
		const response = await app.inject(
			withAuth('PATCH', `/products/${productId}/variants`, {
				payload: { productionType: 'dropship' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.updated).toBe(variantIds.length);

		const rows = await db
			.selectFrom('product_variants')
			.select('production_type')
			.where('product_id', '=', productId)
			.execute();
		expect(rows.every((r) => r.production_type === 'dropship')).toBe(true);
	});

	it("404s when updating a variant in another user's store", async () => {
		const response = await app.inject(
			withAuth('PATCH', `/products/${productId}/variants/${variantIds[0]}`, {
				userId: OTHER_USER_ID,
				payload: { productionType: 'made_to_order' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});

	it('sets production type for every variant in the store', async () => {
		const response = await app.inject(
			withAuth('PATCH', '/products/variants', {
				payload: { productionType: 'digital' },
			}),
		);

		expect(response.statusCode).toBe(200);

		const rows = await db
			.selectFrom('product_variants')
			.innerJoin('products', 'products.id', 'product_variants.product_id')
			.select('product_variants.production_type as production_type')
			.where('products.store_id', '=', TEST_STORE_ID)
			.execute();

		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((r) => r.production_type === 'digital')).toBe(true);
	});
});
