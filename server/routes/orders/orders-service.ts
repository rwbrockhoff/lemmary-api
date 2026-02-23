import { db } from '../../db/connection.js';
import type { Store } from '../../db/database-types.js';
import {
	fetchSquarespaceOrders,
	type NormalizedOrder,
} from './platforms/squarespace.js';

async function getStoreForUser(userId: string): Promise<Store> {
	const store = await db
		.selectFrom('stores')
		.selectAll()
		.where('user_id', '=', userId)
		.executeTakeFirst();

	if (!store) {
		throw new Error('No store found for user');
	}

	return store;
}

async function fetchOrdersFromPlatform(
	store: Store,
): Promise<NormalizedOrder[]> {
	if (store.platform === 'squarespace') {
		return fetchSquarespaceOrders(store.api_key);
	}

	throw new Error(`Unsupported platform: ${store.platform}`);
}

async function upsertOrders(storeId: string, orders: NormalizedOrder[]) {
	return db.transaction().execute(async (trx) => {
		let synced = 0;

		for (const { order, items } of orders) {
			const result = await trx
				.insertInto('orders')
				.values({ ...order, store_id: storeId })
				.onConflict((oc) =>
					oc.columns(['store_id', 'platform_order_id']).doUpdateSet({
						customer_name: order.customer_name,
						customer_email: order.customer_email,
						fulfillment_status: order.fulfillment_status,
						subtotal: order.subtotal,
						shipping_total: order.shipping_total,
						grand_total: order.grand_total,
						updated_at: new Date(),
					}),
				)
				.returning('id')
				.executeTakeFirstOrThrow();

			await trx
				.deleteFrom('order_items')
				.where('order_id', '=', result.id)
				.execute();

			if (items.length > 0) {
				await trx
					.insertInto('order_items')
					.values(items.map((item) => ({ ...item, order_id: result.id })))
					.execute();
			}

			synced++;
		}

		return synced;
	});
}

export async function syncOrders(userId: string) {
	const store = await getStoreForUser(userId);
	const orders = await fetchOrdersFromPlatform(store);
	const synced = await upsertOrders(store.id, orders);

	return { synced, storeId: store.id };
}

export async function getOrders(userId: string) {
	const store = await getStoreForUser(userId);

	const orders = await db
		.selectFrom('orders')
		.selectAll()
		.where('store_id', '=', store.id)
		.orderBy('order_date', 'desc')
		.execute();

	return orders;
}

export async function getOrderWithItems(userId: string, orderId: string) {
	const store = await getStoreForUser(userId);

	const order = await db
		.selectFrom('orders')
		.selectAll()
		.where('id', '=', orderId)
		.where('store_id', '=', store.id)
		.executeTakeFirst();

	if (!order) return null;

	const items = await db
		.selectFrom('order_items')
		.selectAll()
		.where('order_id', '=', order.id)
		.execute();

	return { ...order, items };
}
