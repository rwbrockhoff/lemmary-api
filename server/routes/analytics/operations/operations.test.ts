import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../../tests/test-helpers.js';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - n);
	return isoDate(d);
};
const TODAY = isoDate(new Date());

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
			withAuth('GET', '/analytics/operations', {
				query: { start: daysAgo(30), end: TODAY },
			}),
		);

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.data).toHaveProperty('revenue');
		expect(body.data).toHaveProperty('ordersInProgress');
		expect(body.data).toHaveProperty('ordersCompletedInPeriod');
		expect(body.data).toHaveProperty('avgLeadTime');
		expect(body.data).toHaveProperty('capacity');
		expect(body.data).toHaveProperty('dueSoon');
		expect(body.data).toHaveProperty('ordersTrend');
	});

	it('selects the time bucket based on the range length', async () => {
		const cases: Array<[string, string]> = [
			[daysAgo(20), 'day'],
			[daysAgo(60), 'week'],
			[daysAgo(200), 'month'],
		];

		for (const [start, expectedBucket] of cases) {
			const response = await app.inject(
				withAuth('GET', '/analytics/operations', {
					query: { start, end: TODAY },
				}),
			);
			expect(response.json().data.bucket).toBe(expectedBucket);
		}
	});

	it('reports revenue for the current period', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/operations', {
				query: { start: daysAgo(365), end: TODAY },
			}),
		);

		const { revenue } = response.json().data;
		expect(Number(revenue.current)).toBeGreaterThan(0);
		expect(typeof revenue.changePercent).toBe('number');
	});

	it('calculates average lead time across fulfilled orders', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/operations', {
				query: { start: daysAgo(365), end: TODAY },
			}),
		);

		const { avgLeadTime } = response.json().data;
		expect(avgLeadTime.days).not.toBeNull();
		expect(avgLeadTime.days).toBeGreaterThan(0);
		expect(avgLeadTime.target).toBe(14);
	});

	it('reports weekly capacity as item counts', async () => {
		const response = await app.inject(
			withAuth('GET', '/analytics/operations', {
				query: { start: daysAgo(30), end: TODAY },
			}),
		);

		const { capacity } = response.json().data;
		expect(typeof capacity.dueThisWeek).toBe('number');
		expect(typeof capacity.typicalPerWeek).toBe('number');
		expect(capacity.dueThisWeek).toBeGreaterThanOrEqual(0);
		expect(capacity.typicalPerWeek).toBeGreaterThanOrEqual(0);
	});
});
