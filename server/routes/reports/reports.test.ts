import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';

describe('Reports API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /reports/production-summary returns combined production data', async () => {
		const response = await app.inject(
			withAuth('GET', '/reports/production-summary'),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('drops ready-made items from the production summary', async () => {
		const skus = async () =>
			(await app.inject(withAuth('GET', '/reports/production-summary')))
				.json()
				.data.map((row: { platform_sku: string }) => row.platform_sku);

		const before = await skus();

		await db
			.updateTable('product_variants')
			.set({ production_type: 'ready_made' })
			.where('platform_sku', '=', 'TW-001')
			.execute();
		const after = await skus();

		await db
			.updateTable('product_variants')
			.set({ production_type: 'made_to_order' })
			.where('platform_sku', '=', 'TW-001')
			.execute();

		expect(before).toContain('TW-001');
		expect(after).not.toContain('TW-001');
		expect(after).toEqual(before.filter((sku: string) => sku !== 'TW-001'));
	});

	it('keeps custom order items unless the variant is dropship or digital', async () => {
		const order = await db
			.insertInto('orders')
			.values({
				store_id: TEST_STORE_ID,
				order_type: 'custom',
				order_number: 'C-PROD-TEST',
				order_date: new Date(),
				fulfillment_status: 'pending',
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		await db
			.insertInto('order_items')
			.values({
				order_id: order.id,
				platform_sku: 'TB-001-TAN',
				product_name: 'Test Bag',
				quantity: 1,
			})
			.execute();

		const skus = async () =>
			(await app.inject(withAuth('GET', '/reports/production-summary')))
				.json()
				.data.map((row: { platform_sku: string }) => row.platform_sku);

		try {
			expect(await skus()).toContain('TB-001-TAN');

			await db
				.updateTable('product_variants')
				.set({ production_type: 'dropship' })
				.where('platform_sku', '=', 'TB-001-TAN')
				.execute();

			expect(await skus()).not.toContain('TB-001-TAN');
		} finally {
			await db
				.deleteFrom('order_items')
				.where('order_id', '=', order.id)
				.execute();
			await db.deleteFrom('orders').where('id', '=', order.id).execute();
			await db
				.updateTable('product_variants')
				.set({ production_type: 'ready_made' })
				.where('platform_sku', '=', 'TB-001-TAN')
				.execute();
		}
	});

	it('GET /reports/materials returns the materials report', async () => {
		const response = await app.inject(withAuth('GET', '/reports/materials'));

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('GET /reports/materials buckets entries by measurement and rolls up quantities', async () => {
		const response = await app.inject(withAuth('GET', '/reports/materials'));
		const data = response.json().data;

		expect(Array.isArray(data.fabric)).toBe(true);
		expect(Array.isArray(data.linear)).toBe(true);
		expect(Array.isArray(data.hardware)).toBe(true);
		expect(Array.isArray(data.mismatches)).toBe(true);

		// Seed includes 'Leather' (area) and 'Thread' (linear) BOM, so both buckets
		// should be populated with positive quantities after rolling up across orders
		expect(data.fabric.length).toBeGreaterThan(0);
		expect(data.linear.length).toBeGreaterThan(0);

		const fabricEntry = data.fabric[0];
		expect(fabricEntry).toHaveProperty('material_type');
		expect(fabricEntry).toHaveProperty('product_name');
		expect(fabricEntry).toHaveProperty('piece');
		expect(fabricEntry).toHaveProperty('color');
		expect(fabricEntry.total_quantity).toBeGreaterThan(0);

		const linearEntry = data.linear[0];
		expect(linearEntry).toHaveProperty('material_type');
		expect(linearEntry).toHaveProperty('total_inches');
		expect(linearEntry).toHaveProperty('total_feet');
		expect(linearEntry).toHaveProperty('feet_to_order');
		// feet_to_order should be ceil(inches/12) so it's always >= total_feet rounded down
		expect(linearEntry.feet_to_order).toBeGreaterThanOrEqual(
			Math.floor(linearEntry.total_inches / 12),
		);
	});
});
