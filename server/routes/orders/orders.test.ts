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
		const orders = response.json().data.orders;
		for (const order of orders) {
			expect(order).toHaveProperty('customer_tier');
			if (order.customer_tier !== null) {
				expect(['new', 'loyal', 'super_fan']).toContain(order.customer_tier);
			}
		}
	});

	it('GET /orders/workflow-board includes orders in the completed stage', async () => {
		const response = await app.inject(
			withAuth('GET', '/orders/workflow-board'),
		);

		expect(response.statusCode).toBe(200);
		const { orders, stages } = response.json().data;
		const completedStageIds = new Set(
			stages.filter((s: { is_complete: boolean }) => s.is_complete).map(
				(s: { id: string }) => s.id,
			),
		);
		const completedInResponse = orders.filter((o: { workflow_stage_id: string }) =>
			completedStageIds.has(o.workflow_stage_id),
		);
		expect(completedInResponse.length).toBeGreaterThan(0);
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
});
