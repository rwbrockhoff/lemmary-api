import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../../tests/test-constants.js';
import { db } from '../../../db/connection.js';

describe('Custom orders API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('POST /orders/custom creates a custom order with items', async () => {
		const response = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Pam Beesly',
					customer_email: 'pam@dundermifflin.com',
					items: [
						{
							product_name: 'Watercolor Tote',
							quantity: 2,
							unit_price: '45.00',
						},
					],
				},
			}),
		);

		expect(response.statusCode).toBe(201);
		const order = response.json().data;
		expect(order.order_type).toBe('custom');
		expect(order.order_number).toMatch(/^C-\d+$/);
		expect(order.platform_order_id).toBeNull();
		expect(order.customer_name).toBe('Pam Beesly');
		expect(order.items).toHaveLength(1);
		expect(order.items[0].product_name).toBe('Watercolor Tote');
		expect(Number(order.subtotal)).toBe(90);
	});

	it('POST /orders/custom rejects an order with no items', async () => {
		const response = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Jim Halpert',
					items: [],
				},
			}),
		);

		expect(response.statusCode).toBe(400);
	});

	it('POST /orders/custom rejects a missing customer name', async () => {
		const response = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					items: [{ product_name: 'Watercolor Tote', quantity: 1 }],
				},
			}),
		);

		expect(response.statusCode).toBe(400);
	});

	it('PATCH /orders/custom/:orderId updates order-level fields', async () => {
		const created = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Angela Martin',
					items: [
						{ product_name: 'Cat Calendar', quantity: 1, unit_price: '20.00' },
					],
				},
			}),
		);
		const orderId = created.json().data.id;

		const response = await app.inject(
			withAuth('PATCH', `/orders/custom/${orderId}`, {
				payload: {
					customer_name: 'Angela Schrute',
					order_notes: 'Gift wrap, please.',
				},
			}),
		);

		expect(response.statusCode).toBe(200);
		const order = response.json().data;
		expect(order.customer_name).toBe('Angela Schrute');
		expect(order.order_notes).toBe('Gift wrap, please.');
	});

	it('PATCH /orders/custom/:orderId updates line items and recomputes totals', async () => {
		const created = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Kevin Malone',
					items: [
						{ product_name: 'Chili Tote', quantity: 1, unit_price: '30.00' },
					],
				},
			}),
		);
		const order = created.json().data;
		const existingItemId = order.items[0].id;

		const response = await app.inject(
			withAuth('PATCH', `/orders/custom/${order.id}`, {
				payload: {
					// Edit the existing item and add a new one
					items: [
						{
							id: existingItemId,
							product_name: 'Chili Tote',
							quantity: 2,
							unit_price: '30.00',
						},
						{ product_name: 'Cookie Pouch', quantity: 1, unit_price: '15.00' },
					],
				},
			}),
		);

		expect(response.statusCode).toBe(200);
		const updated = response.json().data;
		expect(updated.items).toHaveLength(2);
		expect(Number(updated.subtotal)).toBe(75);
	});

	it('PATCH /orders/custom/:orderId removes line items', async () => {
		const created = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Oscar Martinez',
					items: [
						{ product_name: 'Tote A', quantity: 1, unit_price: '10.00' },
						{ product_name: 'Tote B', quantity: 1, unit_price: '20.00' },
					],
				},
			}),
		);
		const order = created.json().data;
		const keepId = order.items[0].id;

		const response = await app.inject(
			withAuth('PATCH', `/orders/custom/${order.id}`, {
				payload: {
					items: [
						{
							id: keepId,
							product_name: 'Tote A',
							quantity: 1,
							unit_price: '10.00',
						},
					],
				},
			}),
		);

		expect(response.statusCode).toBe(200);
		const updated = response.json().data;
		expect(updated.items).toHaveLength(1);
		expect(updated.items[0].id).toBe(keepId);
		expect(Number(updated.subtotal)).toBe(10);
	});

	it('PATCH /orders/custom/:orderId preserves an existing item workflow stage', async () => {
		const created = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Stanley Hudson',
					items: [
						{ product_name: 'Pretzel Bag', quantity: 1, unit_price: '12.00' },
					],
				},
			}),
		);
		const order = created.json().data;
		const itemId = order.items[0].id;

		const inProgress = await db
			.selectFrom('order_item_workflow_stages')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('is_default', '=', false)
			.executeTakeFirstOrThrow();

		await db
			.updateTable('order_items')
			.set({ workflow_stage_id: inProgress.id })
			.where('id', '=', itemId)
			.execute();

		const response = await app.inject(
			withAuth('PATCH', `/orders/custom/${order.id}`, {
				payload: {
					items: [
						{
							id: itemId,
							product_name: 'Pretzel Bag',
							quantity: 3,
							unit_price: '12.00',
						},
					],
				},
			}),
		);

		expect(response.statusCode).toBe(200);
		const updated = response.json().data;
		expect(updated.items[0].quantity).toBe(3);
		expect(updated.items[0].workflow_stage_id).toBe(inProgress.id);
	});

	it('PATCH /orders/custom/:orderId returns 404 for a platform order', async () => {
		const platformOrder = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('order_type', '=', 'platform')
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PATCH', `/orders/custom/${platformOrder.id}`, {
				payload: { order_notes: 'should not apply' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});
});
