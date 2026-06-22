import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../../tests/test-helpers.js';
import { db } from '../../../db/connection.js';
import { getPerformance } from './performance-service.js';
import { REPORTING_USER_ID } from '../../../tests/test-constants.js';

describe('GET /analytics/performance', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('returns all dashboard sections', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/performance', { query: { range: '365' } }),
		);

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data).toHaveProperty('stageBottleneck');
		expect(body.data).toHaveProperty('topProducts');
		expect(body.data).toHaveProperty('customerMix');
		expect(body.data).toHaveProperty('couponUsage');
		expect(body.data).toHaveProperty('materialConsumption');
	});

	it('identifies stitching as the slowest production stage', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/performance', { query: { range: '365' } }),
		);

		const stages = response.json().data.stageBottleneck.stages;
		expect(stages.length).toBeGreaterThan(0);

		const slowest = stages.reduce(
			(max: (typeof stages)[number], s: (typeof stages)[number]) =>
				s.avgDays > max.avgDays ? s : max,
		);
		expect(slowest.stageName).toBe('Stitching');
	});

	it('counts coupon usage from seeded orders', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/performance', { query: { range: '365' } }),
		);

		const { withPromoCount, totalCount } = response.json().data.couponUsage;
		expect(totalCount).toBeGreaterThan(0);
		expect(withPromoCount).toBeGreaterThan(0);
		expect(withPromoCount).toBeLessThan(totalCount);
	});

	it('splits customers into new and returning', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/performance', { query: { range: '30' } }),
		);

		const { newCount, returningCount, totalCount } =
			response.json().data.customerMix;
		expect(totalCount).toBeGreaterThan(0);
		expect(newCount + returningCount).toBe(totalCount);
	});

	it('aggregates material consumption across the BOM chain', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/performance', { query: { range: '30' } }),
		);

		const materials = response.json().data.materialConsumption.materials;
		expect(materials.length).toBeGreaterThan(0);
		for (const material of materials) {
			expect(material.currentQty).toBeGreaterThan(0);
			expect(material.priorQty).toBeGreaterThan(0);
		}
	});

	it('gates every section when the store is below the minimums', async () => {
		await db
			.insertInto('users')
			.values({
				id: REPORTING_USER_ID,
				email: 'reporting-sparse@example.com',
				first_name: 'Reporting',
				last_name: 'Sparse',
			})
			.execute();

		const store = await db
			.insertInto('stores')
			.values({
				user_id: REPORTING_USER_ID,
				platform: 'squarespace',
				store_name: 'Sparse Store',
				store_access_token: Buffer.from('test-token'),
				timezone: 'America/Denver',
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		try {
			const data = await getPerformance(REPORTING_USER_ID, { range: '30' });

			// Aggregates drop to null, lists drop to empty
			expect(data.customerMix).toBeNull();
			expect(data.couponUsage).toBeNull();
			expect(data.onTimeDelivery).toBeNull();
			expect(data.stageBottleneck.stages).toEqual([]);
			expect(data.topProducts.products).toEqual([]);
			expect(data.materialConsumption.materials).toEqual([]);
		} finally {
			await db.deleteFrom('stores').where('id', '=', store.id).execute();
			await db
				.deleteFrom('users')
				.where('id', '=', REPORTING_USER_ID)
				.execute();
		}
	});
});
