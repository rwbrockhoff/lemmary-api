import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../../tests/test-helpers.js';

describe('GET /analytics/operations', () => {
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
			withAuth('GET', '/analytics/operations', { query: { range: '30' } }),
		);

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data).toHaveProperty('revenue');
		expect(body.data).toHaveProperty('ordersInProgress');
		expect(body.data).toHaveProperty('ordersCompletedInPeriod');
		expect(body.data).toHaveProperty('avgLeadTime');
		expect(body.data).toHaveProperty('dueSoon');
		expect(body.data).toHaveProperty('ordersTrend');
	});

	it('selects the time bucket based on the requested range', async () => {
		const cases: Array<[string, string]> = [
			['30', 'day'],
			['90', 'week'],
			['365', 'month'],
		];

		for (const [range, expectedBucket] of cases) {
			const response = await app.inject(
				withAuth('GET', '/analytics/operations', { query: { range } }),
			);
			expect(response.json().data.bucket).toBe(expectedBucket);
		}
	});

	it('reports revenue for the current period', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/operations', { query: { range: '365' } }),
		);

		const { revenue } = response.json().data;
		expect(Number(revenue.current)).toBeGreaterThan(0);
		expect(typeof revenue.changePercent).toBe('number');
	});

	it('calculates average lead time across fulfilled orders', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/operations', { query: { range: '365' } }),
		);

		const { avgLeadTime } = response.json().data;
		expect(avgLeadTime.days).not.toBeNull();
		expect(avgLeadTime.days).toBeGreaterThan(0);
		expect(avgLeadTime.target).toBe(14);
	});
});
