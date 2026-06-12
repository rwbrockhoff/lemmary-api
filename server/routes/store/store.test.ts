import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { TEST_STORE_ID, NON_APP_USER_ID } from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';

describe('Store API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('PATCH /store updates the store name', async () => {
		const response = await app.inject(
			withAuth('PATCH', '/store', {
				payload: { storeName: 'Updated Test Store' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.storeName).toBe('Updated Test Store');
	});

	it('PATCH /store with applyLeadTimeToOpenOrders reprices open order due dates', async () => {
		const order = await db
			.selectFrom('orders')
			.select(['id', 'order_date'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('fulfillment_status', '=', 'pending')
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PATCH', '/store', {
				payload: { leadTimeDays: 30, applyLeadTimeToOpenOrders: true },
			}),
		);
		expect(response.statusCode).toBe(200);

		const updated = await db
			.selectFrom('orders')
			.select('due_date')
			.where('id', '=', order.id)
			.executeTakeFirstOrThrow();

		const dueDay = Date.parse(updated.due_date! + 'T00:00:00Z');
		const orderDay = Date.parse(
			order.order_date.toISOString().slice(0, 10) + 'T00:00:00Z',
		);
		const diffDays = Math.round((dueDay - orderDay) / 86400000);
		expect(diffDays).toBe(30);

		// Restore the seeded lead time + reprice due dates back so other suites are unaffected
		await app.inject(
			withAuth('PATCH', '/store', {
				payload: { leadTimeDays: 14, applyLeadTimeToOpenOrders: true },
			}),
		);
	});

	it('PATCH /store returns 404 when the user has no connected store', async () => {
		const response = await app.inject(
			withAuth('PATCH', '/store', {
				userId: NON_APP_USER_ID,
				payload: { storeName: 'Twelve Stitch' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});
});
