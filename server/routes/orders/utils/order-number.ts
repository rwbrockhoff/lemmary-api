import { sql, type Transaction } from 'kysely';
import type { Database } from '../../../db/database-types.js';

const ORDER_NUMBER_PREFIXES = {
	custom: 'C',
	work: 'WO',
} as const;

type LocalOrderType = keyof typeof ORDER_NUMBER_PREFIXES;

export async function generateOrderNumber(
	trx: Transaction<Database>,
	storeId: string,
	type: LocalOrderType,
): Promise<string> {
	const prefix = ORDER_NUMBER_PREFIXES[type];
	const result = await trx
		.selectFrom('orders')
		.select(
			sql<number>`coalesce(max(cast(substring(order_number from '[0-9]+$') as integer)), 1000)`.as(
				'last',
			),
		)
		.where('store_id', '=', storeId)
		.where('order_number', 'like', `${prefix}-%`)
		.executeTakeFirst();

	return `${prefix}-${(result?.last ?? 1000) + 1}`;
}
