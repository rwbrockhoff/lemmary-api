import { sql, type SqlBool } from 'kysely';

// production vs off-the-shelf fulfillment, needs orders + product_variants joined
export function productionItemFilter(
	orders = 'orders',
	variants = 'product_variants',
) {
	const type = sql.ref(`${orders}.order_type`);
	const pt = sql.ref(`${variants}.production_type`);
	return sql<SqlBool>`(
		(${type} in ('custom', 'work') and (${pt} is null or ${pt} not in ('dropship', 'digital')))
		or ${pt} = 'made_to_order'
	)`;
}
