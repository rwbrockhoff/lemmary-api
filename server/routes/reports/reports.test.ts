import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';

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
