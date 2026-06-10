import { describe, it, expect } from 'vitest';
import { TEST_STORE_ID } from '../../../tests/test-constants.js';
import { db } from '../../../db/connection.js';
import { reconcileCompletedOrderStages } from '../sync-service.js';

describe('reconcileCompletedOrderStages', () => {
	it('advances completed orders to the final stage and logs history', async () => {
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

	it('pushes order items into the complete item stage', async () => {
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

	it('backdates history transitions to fulfilled_at', async () => {
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
						fulfilled_at: fulfilledOn,
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

	it('does not affect cancelled orders', async () => {
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

	it('is a no-op when nothing is out of sync', async () => {
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
});
