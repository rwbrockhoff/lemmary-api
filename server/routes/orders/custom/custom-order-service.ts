import { sql } from 'kysely';
import { db } from '../../../db/connection.js';
import type { OrderUpdate } from '../../../db/database-types.js';
import { getStoreForUser } from '../../../utils/store.js';
import { toJsonb } from '../../../utils/json.js';
import { getDefaultStageIds } from '../utils/default-stages.js';
import { generateOrderNumber } from '../utils/order-number.js';
import { sumLineItems } from '../utils/order-totals.js';
import { getOrderWithItems } from '../orders-service.js';
import { syncCustomOrderItems } from './custom-order-items.js';
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
				order_date: input.order_date ?? new Date(),
				due_date: input.due_date ?? null,
				order_notes: input.order_notes ?? null,
				workflow_stage_id: orderStageId,
				subtotal,
				grand_total: subtotal,
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		await trx
			.insertInto('order_items')
			.values(
				input.items.map((item) => ({
					order_id: order.id,
					product_name: item.product_name,
					platform_sku: item.platform_sku ?? null,
					variant_label: toJsonb(item.variant_label ?? null),
					image_url: item.image_url ?? null,
					quantity: item.quantity,
					unit_price: item.unit_price ?? null,
					workflow_stage_id: itemStageId,
				})),
			)
			.execute();

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
	if (input.customer_name !== undefined)
		updates.customer_name = input.customer_name;
	if (input.customer_email !== undefined)
		updates.customer_email = input.customer_email;
	if (input.order_date !== undefined) updates.order_date = input.order_date;
	if (input.due_date !== undefined) updates.due_date = input.due_date;
	if (input.order_notes !== undefined) updates.order_notes = input.order_notes;
	if (input.order_description !== undefined)
		updates.order_description = input.order_description;

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
			await syncCustomOrderItems(trx, orderId, input.items, itemStageId);
		}
	});

	return getOrderWithItems(userId, orderId);
}
