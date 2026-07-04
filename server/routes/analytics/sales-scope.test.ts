import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../tests/test-constants.js';
import { insertTestOrder } from '../../tests/order-factory.js';
import { db } from '../../db/connection.js';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - n);
	return isoDate(d);
};
const WIDE = { start: daysAgo(365), end: isoDate(new Date()) };

describe('sales metrics exclude internal orders', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('does not count work or rework orders in sales metrics', async () => {
		const seed = await db
			.selectFrom('orders')
			.innerJoin('order_items', 'order_items.order_id', 'orders.id')
			.select([
				'orders.customer_email',
				'order_items.platform_sku',
				'order_items.product_name',
			])
			.where('orders.store_id', '=', TEST_STORE_ID)
			.where('orders.order_type', '=', 'platform')
			.where('orders.customer_email', 'is not', null)
			.executeTakeFirstOrThrow();

		const email = seed.customer_email!;

		const ops = () =>
			app
				.inject(withAuth('GET', '/analytics/operations', { query: WIDE }))
				.then((r) => r.json().data);
		const perf = () =>
			app
				.inject(withAuth('GET', '/analytics/performance', { query: WIDE }))
				.then((r) => r.json().data);
		const customer = () =>
			app
				.inject(withAuth('GET', `/customers/${encodeURIComponent(email)}`))
				.then((r) => r.json().data);

		const [opsBefore, perfBefore, customerBefore] = await Promise.all([
			ops(),
			perf(),
			customer(),
		]);
		expect(perfBefore.couponUsage).not.toBeNull();

		// These would show up in every sales metric below if a filter were missing
		const items = [
			{
				productName: seed.product_name,
				platformSku: seed.platform_sku,
				quantity: 5,
			},
		];
		const inserts = await Promise.all([
			insertTestOrder({
				orderType: 'rework',
				customerEmail: email,
				promoCode: 'DRIFT',
				items,
			}),
			insertTestOrder({ orderType: 'work', promoCode: 'DRIFT', items }),
		]);

		try {
			const [opsAfter, perfAfter, customerAfter] = await Promise.all([
				ops(),
				perf(),
				customer(),
			]);

			// a leaked order would count here and change the average
			expect(opsAfter.avgOrderValue.current).toBe(
				opsBefore.avgOrderValue.current,
			);
			expect(opsAfter.revenue.current).toBe(opsBefore.revenue.current);
			expect(perfAfter.couponUsage.totalCount).toBe(
				perfBefore.couponUsage.totalCount,
			);
			// rework shares the email but shouldn't count toward the customer
			expect(customerAfter.orderCount).toBe(customerBefore.orderCount);
			expect(customerAfter.tier).toBe(customerBefore.tier);
		} finally {
			await Promise.all(inserts.map((entry) => entry.cleanup()));
		}
	});
});
