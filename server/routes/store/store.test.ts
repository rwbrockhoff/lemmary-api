import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import {
	TEST_USER_ID,
	TEST_STORE_ID,
	NON_APP_USER_ID,
} from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';
import { createDefaultStages } from './store-service.js';

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

	it('createDefaultStages seeds the default order and item stages', async () => {
		// Run inside a transaction we roll back, so the throwaway store is never
		// committed and parallel suites sharing the test DB don't see it.
		class Rollback extends Error {}

		let orderStages: {
			name: string;
			is_default: boolean;
			is_complete: boolean;
		}[] = [];
		let itemStages: { name: string }[] = [];

		try {
			await db.transaction().execute(async (trx) => {
				const store = await trx
					.insertInto('stores')
					.values({
						user_id: TEST_USER_ID,
						platform: 'squarespace',
						store_name: 'Defaults Test Store',
						store_access_token: Buffer.from('test-token'),
					})
					.returning('id')
					.executeTakeFirstOrThrow();

				await createDefaultStages(store.id, trx);

				orderStages = await trx
					.selectFrom('order_workflow_stages')
					.select(['name', 'is_default', 'is_complete'])
					.where('store_id', '=', store.id)
					.orderBy('position', 'asc')
					.execute();
				itemStages = await trx
					.selectFrom('order_item_workflow_stages')
					.select('name')
					.where('store_id', '=', store.id)
					.orderBy('position', 'asc')
					.execute();

				throw new Rollback();
			});
		} catch (e) {
			if (!(e instanceof Rollback)) throw e;
		}

		expect(orderStages.map((s) => s.name)).toEqual([
			'New',
			'In Progress',
			'Ready to Ship',
			'Fulfilled',
		]);
		expect(orderStages.find((s) => s.is_default)?.name).toBe('New');
		expect(orderStages.find((s) => s.is_complete)?.name).toBe('Fulfilled');
		expect(itemStages.map((s) => s.name)).toEqual([
			'Not Started',
			'In Progress',
			'Done',
		]);
	});
});
