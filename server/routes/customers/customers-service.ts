import { sql } from 'kysely';
import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';
import { computeCustomerTier } from '../../utils/customer-tier.js';
import type { CustomerDetail } from './contract/types.js';

export async function getCustomerByEmail(
	userId: string,
	email: string,
): Promise<CustomerDetail | null> {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const orders = await db
		.with('item_counts', (qb) =>
			qb
				.selectFrom('order_items')
				.innerJoin('orders', 'orders.id', 'order_items.order_id')
				.select(['order_items.order_id', sql<number>`count(*)`.as('total')])
				.where('orders.store_id', '=', store.id)
				.where('orders.customer_email', '=', email)
				.groupBy('order_items.order_id'),
		)
		.selectFrom('orders')
		.leftJoin('item_counts', 'item_counts.order_id', 'orders.id')
		.select([
			'orders.id',
			'orders.order_number',
			'orders.order_date',
			'orders.fulfillment_status',
			'orders.due_date',
			'orders.subtotal',
			'orders.grand_total',
			'orders.customer_name',
			sql<number>`coalesce(item_counts.total, 0)`.as('item_count'),
		])
		.where('orders.store_id', '=', store.id)
		.where('orders.customer_email', '=', email)
		.orderBy('orders.order_date', 'desc')
		.execute();

	if (orders.length === 0) return null;

	const lifetimeSpend = orders.reduce(
		(sum, order) => sum + Number(order.subtotal ?? 0),
		0,
	);

	// Use the most recent name in case it changed across orders.
	const name = orders[0].customer_name;

	return {
		email,
		name,
		tier: computeCustomerTier(orders.length),
		orderCount: orders.length,
		lifetimeSpend: lifetimeSpend.toFixed(2),
		orders: orders.map((order) => ({
			id: order.id,
			order_number: order.order_number,
			order_date: order.order_date,
			fulfillment_status: order.fulfillment_status,
			due_date: order.due_date,
			subtotal: order.subtotal,
			grand_total: order.grand_total,
			item_count: order.item_count,
		})),
	};
}
