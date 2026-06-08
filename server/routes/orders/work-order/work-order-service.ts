import { sql } from 'kysely';
import { db } from '../../../db/connection.js';
import type { OrderUpdate } from '../../../db/database-types.js';
import { getStoreForUser } from '../../../utils/store.js';
import { getDefaultStageIds } from '../utils/default-stages.js';
import { generateOrderNumber } from '../utils/order-number.js';
import { getOrderWithItems } from '../orders-service.js';
import { syncOrderItems } from '../order-items.js';
import type { CreateWorkOrder, UpdateWorkOrder } from '../contract/types.js';

// Work orders are internal production runs
// They use a title instead of customer info and do not have a sales total
// They have line items and move through production workflow like any other order

export async function createWorkOrder(userId: string, input: CreateWorkOrder) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const { orderStageId, itemStageId } = await getDefaultStageIds(store.id);

	const orderId = await db.transaction().execute(async (trx) => {
		const orderNumber = await generateOrderNumber(trx, store.id, 'work');

		const order = await trx
			.insertInto('orders')
			.values({
				store_id: store.id,
				order_type: 'work',
				order_number: orderNumber,
				order_title: input.order_title,
				order_description: input.order_description ?? null,
				order_date: input.order_date ?? new Date(),
				due_date: input.due_date ?? null,
				order_notes: input.order_notes ?? null,
				workflow_stage_id: orderStageId,
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		await syncOrderItems(trx, order.id, input.items, itemStageId);

		return order.id;
	});

	return getOrderWithItems(userId, orderId);
}

export async function updateWorkOrder(
	userId: string,
	orderId: string,
	input: UpdateWorkOrder,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const existing = await db
		.selectFrom('orders')
		.select('order_type')
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!existing || existing.order_type !== 'work') return null;

	const updates: OrderUpdate = {};
	if (input.order_title !== undefined) updates.order_title = input.order_title;
	if (input.order_description !== undefined)
		updates.order_description = input.order_description;
	if (input.order_date !== undefined) updates.order_date = input.order_date;
	if (input.due_date !== undefined) updates.due_date = input.due_date;
	if (input.order_notes !== undefined) updates.order_notes = input.order_notes;

	const { itemStageId } = input.items
		? await getDefaultStageIds(store.id)
		: { itemStageId: null };

	await db.transaction().execute(async (trx) => {
		await trx
			.updateTable('orders')
			.set({ ...updates, updated_at: sql`NOW()` })
			.where('id', '=', orderId)
			.where('store_id', '=', store.id)
			.execute();

		if (input.items) {
			await syncOrderItems(trx, orderId, input.items, itemStageId);
		}
	});

	return getOrderWithItems(userId, orderId);
}
