import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../../tests/test-helpers.js';
import { TEST_STORE_ID, OTHER_USER_ID } from '../../../tests/test-constants.js';
import { db } from '../../../db/connection.js';

describe('Rework orders API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	// A seeded platform order with items and a customer to rework
	async function getParentOrder() {
		return db
			.selectFrom('orders')
			.innerJoin('order_items', 'order_items.order_id', 'orders.id')
			.select(['orders.id', 'orders.customer_email'])
			.where('orders.store_id', '=', TEST_STORE_ID)
			.where('orders.order_type', '=', 'platform')
			.where('orders.customer_email', 'is not', null)
			.executeTakeFirstOrThrow();
	}

	it('POST /orders/rework clones a parent order into a linked rework', async () => {
		const parent = await getParentOrder();

		const response = await app.inject(
			withAuth('POST', '/orders/rework', {
				payload: { parent_order_id: parent.id, rework_reason: 'defect' },
			}),
		);

		expect(response.statusCode).toBe(201);
		const order = response.json().data;
		expect(order.order_type).toBe('rework');
		expect(order.order_number).toMatch(/^R-\d+$/);
		expect(order.parent_order_id).toBe(parent.id);
		expect(order.rework_reason).toBe('defect');
		expect(order.customer_email).toBe(parent.customer_email);
		expect(order.items.length).toBeGreaterThan(0);
		expect(order.subtotal).toBeNull();
		expect(order.grand_total).toBeNull();
	});

	it('POST /orders/rework returns 404 for an unknown parent', async () => {
		const response = await app.inject(
			withAuth('POST', '/orders/rework', {
				payload: {
					parent_order_id: '00000000-0000-0000-0000-000000000000',
					rework_reason: 'defect',
				},
			}),
		);

		expect(response.statusCode).toBe(404);
	});

	it('POST /orders/rework rejects an invalid reason', async () => {
		const parent = await getParentOrder();

		const response = await app.inject(
			withAuth('POST', '/orders/rework', {
				payload: { parent_order_id: parent.id, rework_reason: 'nonsense' },
			}),
		);

		expect(response.statusCode).toBe(400);
	});

	it("POST /orders/rework can't rework an order from another store", async () => {
		const parent = await getParentOrder();

		const response = await app.inject(
			withAuth('POST', '/orders/rework', {
				userId: OTHER_USER_ID,
				payload: { parent_order_id: parent.id, rework_reason: 'defect' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});

	it('PATCH /orders/rework/:orderId trims items and updates the reason', async () => {
		const parent = await getParentOrder();
		const created = await app.inject(
			withAuth('POST', '/orders/rework', {
				payload: { parent_order_id: parent.id, rework_reason: 'defect' },
			}),
		);
		const rework = created.json().data;
		const keepItem = rework.items[0];

		const response = await app.inject(
			withAuth('PATCH', `/orders/rework/${rework.id}`, {
				payload: {
					rework_reason: 'wrong_item',
					order_notes: 'redo the strap only',
					items: [
						{
							id: keepItem.id,
							product_name: keepItem.product_name,
							quantity: 1,
						},
					],
				},
			}),
		);

		expect(response.statusCode).toBe(200);
		const updated = response.json().data;
		expect(updated.rework_reason).toBe('wrong_item');
		expect(updated.order_notes).toBe('redo the strap only');
		expect(updated.items).toHaveLength(1);
	});

	it('PATCH /orders/rework/:orderId returns 404 for a non-rework order', async () => {
		const parent = await getParentOrder();

		const response = await app.inject(
			withAuth('PATCH', `/orders/rework/${parent.id}`, {
				payload: { order_notes: 'should not apply' },
			}),
		);

		expect(response.statusCode).toBe(404);
	});
});
