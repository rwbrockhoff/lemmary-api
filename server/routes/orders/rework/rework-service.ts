import { sql } from 'kysely';
import { db } from '../../../db/connection.js';
import type { OrderUpdate } from '../../../db/database-types.js';
import { getStoreForUser } from '../../../utils/store.js';
import { toJsonb } from '../../../utils/json.js';
import { setColumn } from '../../../utils/update.js';
import { getDefaultStageIds } from '../utils/default-stages.js';
import { generateOrderNumber } from '../utils/order-number.js';
import { getOrderWithItems } from '../orders-service.js';
import { syncOrderItems } from '../order-items.js';
import type {
	CreateRework,
	UpdateRework,
	UpdateOrderLineItem,
} from '../contract/types.js';

// Reworks copies a completed order (customer + items) into a new no-revenue order

export async function createRework(userId: string, input: CreateRework) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const parent = await db
		.selectFrom('orders')
		.select(['customer_name', 'customer_email', 'shipping_address'])
		.where('id', '=', input.parent_order_id)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!parent) return null;

	const parentItems = await db
		.selectFrom('order_items')
		.select([
			'product_name',
			'platform_sku',
			'variant_label',
			'image_url',
			'quantity',
		])
		.where('order_id', '=', input.parent_order_id)
		.execute();

	const { orderStageId, itemStageId } = await getDefaultStageIds(store.id);

	const orderId = await db.transaction().execute(async (trx) => {
		const orderNumber = await generateOrderNumber(trx, store.id, 'rework');

		const order = await trx
			.insertInto('orders')
			.values({
				store_id: store.id,
				order_type: 'rework',
				parent_order_id: input.parent_order_id,
				rework_reason: input.rework_reason,
				order_number: orderNumber,
				customer_name: parent.customer_name,
				customer_email: parent.customer_email,
				shipping_address: toJsonb(parent.shipping_address),
				order_date: new Date(),
				workflow_stage_id: orderStageId,
			})
			.returning('id')
			.executeTakeFirstOrThrow();

		const clonedItems: UpdateOrderLineItem[] = parentItems.map((item) => ({
			product_name: item.product_name,
			platform_sku: item.platform_sku,
			variant_label: item.variant_label,
			image_url: item.image_url,
			quantity: item.quantity,
		}));

		await syncOrderItems(trx, order.id, clonedItems, itemStageId);

		return order.id;
	});

	return getOrderWithItems(userId, orderId);
}

export async function updateRework(
	userId: string,
	orderId: string,
	input: UpdateRework,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const existing = await db
		.selectFrom('orders')
		.select('order_type')
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!existing || existing.order_type !== 'rework') return null;

	const updates: OrderUpdate = {};
	setColumn(updates, 'rework_reason', input.rework_reason);
	setColumn(updates, 'due_date', input.due_date);
	setColumn(updates, 'order_notes', input.order_notes);

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
