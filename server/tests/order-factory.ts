import { db } from '../db/connection.js';
import { TEST_STORE_ID } from './test-constants.js';
import type { OrderType } from '../db/enums.js';

type TestOrderItem = {
	productName: string;
	platformSku?: string | null;
	quantity?: number;
};

type InsertTestOrderOptions = {
	orderType: OrderType;
	orderDate?: Date;
	customerEmail?: string | null;
	customerName?: string | null;
	promoCode?: string | null;
	fulfilledAt?: Date | null;
	dueDate?: string | null;
	items?: TestOrderItem[];
};

// Inserts an order + items into the test store, returns an id and a cleanup
export async function insertTestOrder(options: InsertTestOrderOptions) {
	const order = await db
		.insertInto('orders')
		.values({
			store_id: TEST_STORE_ID,
			order_type: options.orderType,
			order_number: `DRIFT-${options.orderType}`,
			order_date: options.orderDate ?? new Date(),
			customer_email: options.customerEmail ?? null,
			customer_name: options.customerName ?? 'Drift Guard',
			promo_code: options.promoCode ?? null,
			fulfilled_at: options.fulfilledAt ?? null,
			due_date: options.dueDate ?? null,
		})
		.returning('id')
		.executeTakeFirstOrThrow();

	if (options.items?.length) {
		await db
			.insertInto('order_items')
			.values(
				options.items.map((item) => ({
					order_id: order.id,
					product_name: item.productName,
					platform_sku: item.platformSku ?? null,
					quantity: item.quantity ?? 1,
				})),
			)
			.execute();
	}

	return {
		orderId: order.id,
		cleanup: async () => {
			await db
				.deleteFrom('order_items')
				.where('order_id', '=', order.id)
				.execute();
			await db.deleteFrom('orders').where('id', '=', order.id).execute();
		},
	};
}
