import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../../tests/test-constants.js';
import { db } from '../../../db/connection.js';

describe('Orders API', () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		app = buildTestApp();
		await app.ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it('GET /orders returns pending orders with their items', async () => {
		const response = await app.inject(withAuth('GET', '/orders'));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(Array.isArray(body.data.orders)).toBe(true);
		expect(body.data.orders.length).toBeGreaterThan(0);
		expect(Array.isArray(body.data.orders[0].items)).toBe(true);
		expect(body.data).toHaveProperty('hasMore');
		expect(body.data).toHaveProperty('lastSyncedAt');
	});

	it('GET /orders counts item quantity, not line item rows, for progress', async () => {
		const created = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Phyllis Vance',
					items: [
						{ product_name: 'Bloomers Tote', quantity: 3, unit_price: '25.00' },
					],
				},
			}),
		);
		const orderId = created.json().data.id;

		const response = await app.inject(withAuth('GET', '/orders'));
		const order = response.json().data.orders.find(
			(o: { id: string }) => o.id === orderId,
		);

		expect(order).toBeDefined();
		expect(order.item_count).toBe(3);
	});

	it('GET /orders includes customer_tier on each row', async () => {
		const response = await app.inject(withAuth('GET', '/orders'));

		expect(response.statusCode).toBe(200);
		const orders = response.json().data.orders;
		for (const order of orders) {
			expect(order).toHaveProperty('customer_tier');
			if (order.customer_tier !== null) {
				expect(['new', 'loyal', 'super_fan']).toContain(order.customer_tier);
			}
		}
	});

	it('GET /orders/:orderId returns a single order with items', async () => {
		const order = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(withAuth('GET', `/orders/${order.id}`));

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.data.id).toBe(order.id);
		expect(Array.isArray(body.data.items)).toBe(true);
	});

	it('PUT /orders/:orderId/stage updates the stage and records a transition', async () => {
		const order = await db
			.selectFrom('orders')
			.select(['id', 'workflow_stage_id'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('fulfillment_status', '=', 'pending')
			.executeTakeFirstOrThrow();

		const newStage = await db
			.selectFrom('order_workflow_stages')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('id', '!=', order.workflow_stage_id)
			.executeTakeFirstOrThrow();

		const historyBefore = await db
			.selectFrom('order_stage_history')
			.select(db.fn.count<number>('id').as('count'))
			.where('order_id', '=', order.id)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PUT', `/orders/${order.id}/stage`, {
				payload: { stageId: newStage.id },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.workflow_stage_id).toBe(newStage.id);

		const historyAfter = await db
			.selectFrom('order_stage_history')
			.select(db.fn.count<number>('id').as('count'))
			.where('order_id', '=', order.id)
			.executeTakeFirstOrThrow();

		expect(Number(historyAfter.count)).toBe(Number(historyBefore.count) + 1);
	});

	it('PUT /orders/:orderId/stage fulfills a custom order in a complete stage and reopens it', async () => {
		// A fresh custom order starts out pending
		const created = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Creed Bratton',
					items: [{ product_name: 'Mung Beans', quantity: 1 }],
				},
			}),
		);
		const orderId = created.json().data.id;

		// Grab a completed and an open stage to move the order between
		const completeStage = await db
			.selectFrom('order_workflow_stages')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('is_complete', '=', true)
			.executeTakeFirstOrThrow();

		const openStage = await db
			.selectFrom('order_workflow_stages')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('is_complete', '=', false)
			.executeTakeFirstOrThrow();

		// Moving into a completed stage should mark it fulfilled
		const fulfilled = await app.inject(
			withAuth('PUT', `/orders/${orderId}/stage`, {
				payload: { stageId: completeStage.id },
			}),
		);
		expect(fulfilled.statusCode).toBe(200);
		expect(fulfilled.json().data.fulfillment_status).toBe('fulfilled');

		// Reopening it should drop it back to pending
		const reopened = await app.inject(
			withAuth('PUT', `/orders/${orderId}/stage`, {
				payload: { stageId: openStage.id },
			}),
		);
		expect(reopened.json().data.fulfillment_status).toBe('pending');
	});

	it('PUT /orders/:orderId/stage leaves platform order fulfillment untouched', async () => {
		// Platform fulfillment comes from the sync, so a stage move shouldn't touch it
		const platformOrder = await db
			.selectFrom('orders')
			.select(['id', 'fulfillment_status'])
			.where('store_id', '=', TEST_STORE_ID)
			.where('order_type', '=', 'platform')
			.executeTakeFirstOrThrow();

		const completeStage = await db
			.selectFrom('order_workflow_stages')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('is_complete', '=', true)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PUT', `/orders/${platformOrder.id}/stage`, {
				payload: { stageId: completeStage.id },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.fulfillment_status).toBe(
			platformOrder.fulfillment_status,
		);
	});

	it('GET /orders?status=completed returns fulfilled orders', async () => {
		const response = await app.inject(
			withAuth('GET', '/orders?status=completed'),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('GET /orders/workflow-board returns the kanban view', async () => {
		const response = await app.inject(
			withAuth('GET', '/orders/workflow-board'),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it('GET /orders/workflow-board includes customer_tier on each row', async () => {
		const response = await app.inject(
			withAuth('GET', '/orders/workflow-board'),
		);

		expect(response.statusCode).toBe(200);
		const stages = response.json().data.stages;
		for (const stage of stages) {
			for (const order of stage.orders) {
				expect(order).toHaveProperty('customer_tier');
				if (order.customer_tier !== null) {
					expect(['new', 'loyal', 'super_fan']).toContain(order.customer_tier);
				}
			}
		}
	});

	it('GET /orders/workflow-board includes orders in the completed stage', async () => {
		const response = await app.inject(
			withAuth('GET', '/orders/workflow-board'),
		);

		expect(response.statusCode).toBe(200);
		const stages = response.json().data.stages;
		const completedStage = stages.find(
			(s: { is_complete: boolean }) => s.is_complete,
		);
		expect(completedStage).toBeDefined();
		expect(completedStage.orders.length).toBeGreaterThan(0);
	});

	it('GET /orders/workflow-board returns hasMore on every stage', async () => {
		const response = await app.inject(
			withAuth('GET', '/orders/workflow-board'),
		);

		expect(response.statusCode).toBe(200);
		const stages = response.json().data.stages;
		for (const stage of stages) {
			expect(stage).toHaveProperty('hasMore');
			expect(typeof stage.hasMore).toBe('boolean');
		}
	});

	it('GET /orders/workflow-board/stages/:stageId/orders returns paginated orders for one stage', async () => {
		// grab any stage that has at least one seeded order
		const stage = await db
			.selectFrom('orders')
			.innerJoin(
				'order_workflow_stages',
				'order_workflow_stages.id',
				'orders.workflow_stage_id',
			)
			.select('order_workflow_stages.id')
			.where('orders.store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth(
				'GET',
				`/orders/workflow-board/stages/${stage.id}/orders?limit=5&offset=0`,
			),
		);

		expect(response.statusCode).toBe(200);
		const { orders, hasMore } = response.json().data;
		expect(Array.isArray(orders)).toBe(true);
		expect(orders.length).toBeLessThanOrEqual(5);
		expect(typeof hasMore).toBe('boolean');
	});

	it('GET /orders/workflow-board/stages/:stageId/orders returns 404 for an unknown stage', async () => {
		const response = await app.inject(
			withAuth(
				'GET',
				`/orders/workflow-board/stages/00000000-0000-0000-0000-000000000000/orders`,
			),
		);

		expect(response.statusCode).toBe(404);
	});

	it('PUT /orders/:orderId/notes updates the notes', async () => {
		const order = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PUT', `/orders/${order.id}/notes`, {
				payload: { notes: 'Customer requested rush shipping.' },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.order_notes).toBe(
			'Customer requested rush shipping.',
		);
	});

	it('PUT /orders/:orderId/items/completion marks all items complete', async () => {
		const order = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('fulfillment_status', '=', 'pending')
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PUT', `/orders/${order.id}/items/completion`),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.orderId).toBe(order.id);
	});

	it('PUT /orders/:orderId/items/:itemId/stage updates an order item stage', async () => {
		const order = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('fulfillment_status', '=', 'pending')
			.executeTakeFirstOrThrow();

		const item = await db
			.selectFrom('order_items')
			.select('id')
			.where('order_id', '=', order.id)
			.executeTakeFirstOrThrow();

		const stage = await db
			.selectFrom('order_item_workflow_stages')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('PUT', `/orders/${order.id}/items/${item.id}/stage`, {
				payload: { stageId: stage.id },
			}),
		);

		expect(response.statusCode).toBe(200);
		expect(response.json().data.workflow_stage_id).toBe(stage.id);
	});

	it('DELETE /orders/:orderId deletes a custom order', async () => {
		const created = await app.inject(
			withAuth('POST', '/orders/custom', {
				payload: {
					customer_name: 'Kevin Malone',
					items: [{ product_name: 'Chili Pot', quantity: 1 }],
				},
			}),
		);
		const orderId = created.json().data.id;

		const deleted = await app.inject(withAuth('DELETE', `/orders/${orderId}`));
		expect(deleted.statusCode).toBe(200);

		const after = await app.inject(withAuth('GET', `/orders/${orderId}`));
		expect(after.statusCode).toBe(404);
	});

	it('DELETE /orders/:orderId refuses to delete a platform order', async () => {
		const platformOrder = await db
			.selectFrom('orders')
			.select('id')
			.where('store_id', '=', TEST_STORE_ID)
			.where('order_type', '=', 'platform')
			.executeTakeFirstOrThrow();

		const response = await app.inject(
			withAuth('DELETE', `/orders/${platformOrder.id}`),
		);

		expect(response.statusCode).toBe(409);
	});
});
