import { db } from '../../db/connection.js';
import { getStoreForUser } from '../../utils/store.js';

const LIMIT = 3;

export async function search(userId: string, query: string) {
	const empty = { orders: [], products: [], customers: [] };

	const store = await getStoreForUser(userId);
	if (!store) return empty;

	const q = query.trim();
	if (q.length < 1) return empty;

	const like = `%${q}%`;

	const [orders, products, customers] = await Promise.all([
		db
			.selectFrom('orders')
			.select(['id', 'order_number', 'customer_name', 'order_type'])
			.where('store_id', '=', store.id)
			.where((eb) =>
				eb.or([
					eb('order_number', 'ilike', like),
					eb('customer_name', 'ilike', like),
					eb('order_title', 'ilike', like),
				]),
			)
			.orderBy('order_date', 'desc')
			.limit(LIMIT)
			.execute(),

		db
			.selectFrom('products')
			.select(['id', 'name', 'image_url'])
			.where('store_id', '=', store.id)
			.where('name', 'ilike', like)
			.orderBy('name', 'asc')
			.limit(LIMIT)
			.execute(),

		db
			.selectFrom('orders')
			.select(['customer_email', 'customer_name'])
			.distinctOn('customer_email')
			.where('store_id', '=', store.id)
			.where('customer_email', 'is not', null)
			.where((eb) =>
				eb.or([
					eb('customer_name', 'ilike', like),
					eb('customer_email', 'ilike', like),
				]),
			)
			.orderBy('customer_email')
			.orderBy('order_date', 'desc')
			.limit(LIMIT)
			.execute(),
	]);

	return {
		orders,
		products,
		customers: customers.map((c) => ({
			email: c.customer_email ?? '',
			name: c.customer_name ?? '',
		})),
	};
}
