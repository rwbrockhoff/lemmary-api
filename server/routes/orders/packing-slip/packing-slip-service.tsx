import { renderToBuffer } from '@react-pdf/renderer';
import { db } from '../../../db/connection.js';
import { getStoreForUser } from '../../../utils/store.js';
import {
	PackingSlipDocument,
	type SlipItem,
	type SlipOrder,
} from './packing-slip-document.js';

export async function generatePackingSlips(
	userId: string,
	orderIds: string[],
): Promise<Buffer | null> {
	const store = await getStoreForUser(userId);
	if (!store) return null;

	const orders = await db
		.selectFrom('orders')
		.select([
			'id',
			'order_number',
			'order_date',
			'customer_name',
			'shipping_address',
		])
		.where('store_id', '=', store.id)
		.where('id', 'in', orderIds)
		.orderBy('order_date', 'asc')
		.execute();

	if (orders.length === 0) return null;

	const items = await db
		.selectFrom('order_items')
		.select(['order_id', 'product_name', 'variant_label', 'quantity'])
		.where(
			'order_id',
			'in',
			orders.map((order) => order.id),
		)
		.orderBy('created_at', 'asc')
		.orderBy('id', 'asc')
		.execute();

	const itemsByOrder = new Map<string, SlipItem[]>();
	for (const item of items) {
		const list = itemsByOrder.get(item.order_id) ?? [];
		list.push(item);
		itemsByOrder.set(item.order_id, list);
	}

	const slipOrders: SlipOrder[] = orders.map((order) => ({
		order_number: order.order_number,
		order_date: order.order_date,
		customer_name: order.customer_name,
		shipping_address: order.shipping_address,
		items: itemsByOrder.get(order.id) ?? [],
	}));

	return renderToBuffer(
		<PackingSlipDocument
			storeName={store.store_name}
			logoUrl={store.logo_url}
			tagline={store.tagline}
			websiteUrl={store.website_url}
			contactEmail={store.contact_email}
			timeZone={store.timezone}
			orders={slipOrders}
		/>,
	);
}
