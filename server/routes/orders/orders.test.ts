import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, withAuth } from '../../tests/test-helpers.js';
import { TEST_STORE_ID } from '../../tests/test-constants.js';
import { db } from '../../db/connection.js';
import { reconcileCompletedOrderStages } from './orders-service.js';

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

	it('reconcileCompletedOrderStages advances completed orders to the final stage and logs history', async () => {
		// Run the whole test inside a transaction we deliberately roll back at the end
		// so our setup mutations don't leak into other tests

		const ROLLBACK = new Error('__rollback_test_tx__');

		await db
			.transaction()
			.execute(async (trx) => {
				const finalStage = await trx
					.selectFrom('order_workflow_stages')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.where('is_complete', '=', true)
					.executeTakeFirstOrThrow();

				const nonFinalStage = await trx
					.selectFrom('order_workflow_stages')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.where('is_complete', '=', false)
					.executeTakeFirstOrThrow();

				const order = await trx
					.selectFrom('orders')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.executeTakeFirstOrThrow();

				// Simulate the limbo state: completed on the platform but stuck
				// at a mid-pipeline workflow stage
				await trx
					.updateTable('orders')
					.set({
						fulfillment_status: 'fulfilled',
						workflow_stage_id: nonFinalStage.id,
					})
					.where('id', '=', order.id)
					.execute();

				const historyBefore = await trx
					.selectFrom('order_stage_history')
					.select(trx.fn.count<number>('id').as('count'))
					.where('order_id', '=', order.id)
					.executeTakeFirstOrThrow();

				const updatedCount = await reconcileCompletedOrderStages(
					trx,
					TEST_STORE_ID,
				);

				expect(updatedCount).toBeGreaterThan(0);

				// Order should now be at the store's final stage
				const after = await trx
					.selectFrom('orders')
					.select('workflow_stage_id')
					.where('id', '=', order.id)
					.executeTakeFirstOrThrow();

				expect(after.workflow_stage_id).toBe(finalStage.id);

				// The transition should be in order stage history table
				const historyAfter = await trx
					.selectFrom('order_stage_history')
					.select(trx.fn.count<number>('id').as('count'))
					.where('order_id', '=', order.id)
					.executeTakeFirstOrThrow();

				expect(Number(historyAfter.count)).toBe(
					Number(historyBefore.count) + 1,
				);

				// Rollback after assertions
				throw ROLLBACK;
			})
			.catch((err) => {
				if (err !== ROLLBACK) throw err;
			});
	});

	it('reconcileCompletedOrderStages pushes order items into the complete item stage', async () => {
		const ROLLBACK = new Error('__rollback_test_tx__');

		await db
			.transaction()
			.execute(async (trx) => {
				// grab non-final order + item stages so we can park the order/items there
				const nonFinalOrderStage = await trx
					.selectFrom('order_workflow_stages')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.where('is_complete', '=', false)
					.executeTakeFirstOrThrow();

				const nonFinalItemStage = await trx
					.selectFrom('order_item_workflow_stages')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.where('is_complete', '=', false)
					.executeTakeFirstOrThrow();

				const finalItemStage = await trx
					.selectFrom('order_item_workflow_stages')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.where('is_complete', '=', true)
					.executeTakeFirstOrThrow();

				// grab a test order and force its items into a non-final item stage
				const order = await trx
					.selectFrom('orders')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.executeTakeFirstOrThrow();

				await trx
					.updateTable('orders')
					.set({
						fulfillment_status: 'fulfilled',
						workflow_stage_id: nonFinalOrderStage.id,
					})
					.where('id', '=', order.id)
					.execute();

				await trx
					.updateTable('order_items')
					.set({ workflow_stage_id: nonFinalItemStage.id })
					.where('order_id', '=', order.id)
					.execute();

				await reconcileCompletedOrderStages(trx, TEST_STORE_ID);

				// every item on the order should now be at the final item stage
				const items = await trx
					.selectFrom('order_items')
					.select('workflow_stage_id')
					.where('order_id', '=', order.id)
					.execute();

				expect(items.length).toBeGreaterThan(0);
				for (const item of items) {
					expect(item.workflow_stage_id).toBe(finalItemStage.id);
				}

				throw ROLLBACK;
			})
			.catch((err) => {
				if (err !== ROLLBACK) throw err;
			});
	});

	it('reconcileCompletedOrderStages backdates history transitions to fulfilled_on', async () => {
		const ROLLBACK = new Error('__rollback_test_tx__');

		await db
			.transaction()
			.execute(async (trx) => {
				// grab the first non-final stage so we can put the order into it
				const firstStage = await trx
					.selectFrom('order_workflow_stages')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.where('is_complete', '=', false)
					.orderBy('position', 'asc')
					.executeTakeFirstOrThrow();

				// grab a test order to modify
				const order = await trx
					.selectFrom('orders')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.executeTakeFirstOrThrow();

				// grab the final (is_complete) stage for the to_stage lookup later
				const finalStage = await trx
					.selectFrom('order_workflow_stages')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.where('is_complete', '=', true)
					.executeTakeFirstOrThrow();

				const fulfilledOn = new Date('2026-01-15T10:30:00Z');

				// simulate the limbo state - fulfilled on the platform but at a non-final stage
				await trx
					.updateTable('orders')
					.set({
						fulfillment_status: 'fulfilled',
						workflow_stage_id: firstStage.id,
						fulfilled_on: fulfilledOn,
					})
					.where('id', '=', order.id)
					.execute();

				// run our reconcile - this should move the order to the final stage
				await reconcileCompletedOrderStages(trx, TEST_STORE_ID);

				// find the history row reconcile inserted
				const history = await trx
					.selectFrom('order_stage_history')
					.select('transitioned_at')
					.where('order_id', '=', order.id)
					.where('from_stage_id', '=', firstStage.id)
					.where('to_stage_id', '=', finalStage.id)
					.executeTakeFirstOrThrow();

				expect(history.transitioned_at.toISOString()).toBe(
					fulfilledOn.toISOString(),
				);

				// Rollback to remove our changes for this test
				throw ROLLBACK;
			})
			.catch((err) => {
				if (err !== ROLLBACK) throw err;
			});
	});

	it('reconcileCompletedOrderStages does not affect cancelled orders', async () => {
		const ROLLBACK = new Error('__rollback_test_tx__');

		await db
			.transaction()
			.execute(async (trx) => {
				// grab a non-final stage to park the canceled order in
				const nonFinalStage = await trx
					.selectFrom('order_workflow_stages')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.where('is_complete', '=', false)
					.executeTakeFirstOrThrow();

				// grab a test order
				const order = await trx
					.selectFrom('orders')
					.select('id')
					.where('store_id', '=', TEST_STORE_ID)
					.executeTakeFirstOrThrow();

				// set the order as canceled in a non-final stage
				await trx
					.updateTable('orders')
					.set({
						fulfillment_status: 'canceled',
						workflow_stage_id: nonFinalStage.id,
					})
					.where('id', '=', order.id)
					.execute();

				// reconcile should ignore canceled orders
				await reconcileCompletedOrderStages(trx, TEST_STORE_ID);

				// verify the order is still at the non-final stage
				const after = await trx
					.selectFrom('orders')
					.select('workflow_stage_id')
					.where('id', '=', order.id)
					.executeTakeFirstOrThrow();

				expect(after.workflow_stage_id).toBe(nonFinalStage.id);

				// Rollback changes to DB after test
				throw ROLLBACK;
			})
			.catch((err) => {
				if (err !== ROLLBACK) throw err;
			});
	});

	it('reconcileCompletedOrderStages is a no-op when nothing is out of sync', async () => {
		const ROLLBACK = new Error('__rollback_test_tx__');

		await db
			.transaction()
			.execute(async (trx) => {
				const updatedCount = await reconcileCompletedOrderStages(
					trx,
					TEST_STORE_ID,
				);
				expect(updatedCount).toBe(0);
				throw ROLLBACK;
			})
			.catch((err) => {
				if (err !== ROLLBACK) throw err;
			});
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
});
