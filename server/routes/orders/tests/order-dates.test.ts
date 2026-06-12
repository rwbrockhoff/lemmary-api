import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../../tests/test-constants.js';
import { db } from '../../../db/connection.js';

describe('Order dates API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	const createCustomOrder = async () => {
		const response = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Angela Martin',
					items: [
						{ product_name: 'Lupine Sling', quantity: 1, unit_price: '60.00' },
					],
				},
			}),
		);
		return response.json().data.id as string;
	};

	it('PUT /orders/:orderId/dates updates the due date', async () => {
		const orderId = await createCustomOrder();

		const response = await app.inject(
			withAuth('PUT', `/orders/${orderId}/dates`, {
				payload: { due_date: '2026-08-15' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.due_date).toBe('2026-08-15');
	});

	it('PUT /orders/:orderId/dates clears the due date with null', async () => {
		const orderId = await createCustomOrder();

		const response = await app.inject(
			withAuth('PUT', `/orders/${orderId}/dates`, {
				payload: { due_date: null },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.due_date).toBeNull();
	});

	it('PUT /orders/:orderId/dates updates the order date on a custom order', async () => {
		const orderId = await createCustomOrder();

		const response = await app.inject(
			withAuth('PUT', `/orders/${orderId}/dates`, {
				payload: { order_date: '2026-06-20' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.order_date.slice(0, 10)).toBe('2026-06-20');
	});

	it('PUT /orders/:orderId/dates leaves a platform order date unchanged', async () => {
		const platformOrder = await db
			.selectFrom('orders')
			.select(['id', 'order_date', 'due_date'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('order_type', '=', 'platform')
			.executeTakeFirstOrThrow();

		const originalOrderDay = platformOrder.order_date
			.toISOString()
			.slice(0, 10);

		const response = await app.inject(
			withAuth('PUT', `/orders/${platformOrder.id}/dates`, {
				payload: { order_date: '2020-01-01', due_date: '2026-09-01' },
			}),
		);

		expect(response.statusCode).toBe(200);
		const updated = response.json().data;

		// Due date is editable on any order, but the order date stays matching store platform
		expect(updated.due_date).toBe('2026-09-01');
		expect(updated.order_date.slice(0, 10)).toBe(originalOrderDay);

		// Reset the seeded due date
		await db
			.updateTable('orders')
			.set({ due_date: platformOrder.due_date })
			.where('id', '=', platformOrder.id)
			.execute();
	});

	it('PUT /orders/:orderId/dates returns 404 for an order outside the store', async () => {
		const response = await app.inject(
			withAuth('PUT', '/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dates', {
				payload: { due_date: '2026-08-15' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});
});
