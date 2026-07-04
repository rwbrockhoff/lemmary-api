import { db } from '../../../db/connection.js';
import { getStoreForUser } from '../../../utils/store.js';
import { toJsonb } from '../../../utils/json.js';
import { getDefaultStageIds } from '../utils/default-stages.js';
import { generateOrderNumber } from '../utils/order-number.js';
import { getOrderWithItems } from '../orders-service.js';
import { syncOrderItems } from '../order-items.js';
import type { CreateRework, UpdateOrderLineItem } from '../contract/types.js';

// Reworks copies a completed order (customer + items) into a new no-revenue order

export async function createRework(
	userId: string,
	parentOrderId: string,
	input: CreateRework,
) {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const parent = await db
		.selectFrom('orders')
		.select(['customer_name', 'customer_email', 'shipping_address'])
		.where('id', '=', parentOrderId)
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
		.where('order_id', '=', parentOrderId)
		.execute();

	const { orderStageId, itemStageId } = await getDefaultStageIds(store.id);

	const orderId = await db.transaction().execute(async (trx) => {
		const orderNumber = await generateOrderNumber(trx, store.id, 'rework');

		const order = await trx
			.insertInto('orders')
			.values({
				store_id: store.id,
				order_type: 'rework',
				parent_order_id: parentOrderId,
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
