import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../../tests/test-constants.js';
import { db } from '../../../db/connection.js';

describe('Work orders API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('POST /orders/work creates a work order with items', async () => {
		const response = await app.inject(
			withAuth('POST', '/orders/work', {
				payload: {
					order_title: 'Spring market restock',
					order_description: 'Build ahead for the April market',
					items: [
						{ product_name: 'Lupine Sling', quantity: 5, unit_price: '60.00' },
					],
				},
			}),
		);

		expect(response.statusCode).toBe(201);
		const order = response.json().data;
		expect(order.order_type).toBe('work');
		expect(order.order_number).toMatch(/^WO-\d+$/);
		expect(order.order_title).toBe('Spring market restock');
		expect(order.customer_name).toBeNull();
		expect(order.items).toHaveLength(1);
		expect(order.items[0].product_name).toBe('Lupine Sling');
	});

	it('POST /orders/work rejects a missing title', async () => {
		const response = await app.inject(
			withAuth('POST', '/orders/work', {
				payload: {
					items: [{ product_name: 'Lupine Sling', quantity: 1 }],
				},
			}),
		);

		expect(response.statusCode).toBe(400);
	});

	it('POST /orders/work rejects an order with no items', async () => {
		const response = await app.inject(
			withAuth('POST', '/orders/work', {
				payload: { order_title: 'Empty run', items: [] },
			}),
		);

		expect(response.statusCode).toBe(400);
	});

	it('PATCH /orders/work/:orderId updates order-level fields', async () => {
		const created = await app.inject(
			withAuth('POST', '/orders/work', {
				payload: {
					order_title: 'Sample batch',
					items: [{ product_name: 'Pika Sling', quantity: 2 }],
				},
			}),
		);
		const orderId = created.json().data.id;

		const response = await app.inject(
			withAuth('PATCH', `/orders/work/${orderId}`, {
				payload: {
					order_title: 'Wholesale sample batch',
					order_notes: 'For the boutique pitch',
				},
			}),
		);

		expect(response.statusCode).toBe(200);
		const order = response.json().data;
		expect(order.order_title).toBe('Wholesale sample batch');
		expect(order.order_notes).toBe('For the boutique pitch');
	});

	it('PATCH /orders/work/:orderId updates line items', async () => {
		const created = await app.inject(
			withAuth('POST', '/orders/work', {
				payload: {
					order_title: 'Stock build',
					items: [{ product_name: 'Lupine Sling', quantity: 5 }],
				},
			}),
		);
		const order = created.json().data;
		const existingItemId = order.items[0].id;

		const response = await app.inject(
			withAuth('PATCH', `/orders/work/${order.id}`, {
				payload: {
					// Edit the existing item and add a new one
					items: [
						{ id: existingItemId, product_name: 'Lupine Sling', quantity: 8 },
						{ product_name: 'English Garden Sling', quantity: 5 },
					],
				},
			}),
		);

		expect(response.statusCode).toBe(200);
		const updated = response.json().data;
		expect(updated.items).toHaveLength(2);
	});

	it('PATCH /orders/work/:orderId returns 404 for a non-work order', async () => {
		const platformOrder = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('order_type', '=', 'platform')
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PATCH', `/orders/work/${platformOrder.id}`, {
				payload: { order_notes: 'should not apply' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});
});
