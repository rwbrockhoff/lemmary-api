import { sql } from 'kysely';
import { db } from '../../../db/connection.js';
import type { OrderUpdate } from '../../../db/database-types.js';
import { getStoreForUser } from '../../../utils/store.js';
import { toNoonUtc } from '../../../utils/timezone.js';
import { setColumn } from '../../../utils/update.js';
import { getDefaultStageIds } from '../utils/default-stages.js';
import { generateOrderNumber } from '../utils/order-number.js';
import { sumLineItems } from '../utils/order-totals.js';
import { getOrderWithItems } from '../orders-service.js';
import { syncOrderItems } from '../order-items.js';
import type {
	CreateCustomOrder,
	UpdateCustomOrder,
} from '../contract/types.js';

export async function createCustomOrder(
	userId: string,
	input: CreateCustomOrder,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const { orderStageId, itemStageId } = await getDefaultStageIds(store.id);
	const subtotal = sumLineItems(input.items);

	const orderId = await db.transaction().execute(async (trx) => {
		const orderNumber = await generateOrderNumber(trx, store.id, 'custom');

		const order = await trx
			.insertInto('orders')
			.values({
				store_id: store.id,
				order_type: 'custom',
				order_number: orderNumber,
				customer_name: input.customer_name,
				customer_email: input.customer_email ?? null,
				order_date: input.order_date ? toNoonUtc(input.order_date) : new Date(),
				due_date: input.due_date ?? null,
				order_notes: input.order_notes ?? null,
				workflow_stage_id: orderStageId,
				subtotal,
				grand_total: subtotal,
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		await syncOrderItems(trx, order.id, input.items, itemStageId);

		return order.id;
	});

	return getOrderWithItems(userId, orderId);
}

export async function updateCustomOrder(
	userId: string,
	orderId: string,
	input: UpdateCustomOrder,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const existing = await db
		.selectFrom('orders')
		.select('order_type')
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!existing || existing.order_type !== 'custom') return null;

	const updates: OrderUpdate = {};
	setColumn(updates, 'customer_name', input.customer_name);
	setColumn(updates, 'customer_email', input.customer_email);
	setColumn(updates, 'due_date', input.due_date);
	setColumn(updates, 'order_notes', input.order_notes);
	setColumn(updates, 'order_description', input.order_description);

	if (input.order_date !== undefined) {
		updates.order_date = toNoonUtc(input.order_date);
	}

	if (input.items) {
		const subtotal = sumLineItems(input.items);
		updates.subtotal = subtotal;
		updates.grand_total = subtotal;
	}

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
