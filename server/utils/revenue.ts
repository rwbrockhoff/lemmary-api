import { sql, type RawBuilder } from 'kysely';

// Subtotal minus discounts — product sold, before shipping and tax
// Optional filter scopes the sum (e.g. to a date range)
export const netRevenueSum = (filter?: RawBuilder<unknown>) => {
	if (!filter) {
		return sql<string>`coalesce(sum(subtotal - coalesce(discount_total, 0)), 0)`;
	}
	return sql<string>`coalesce(sum(subtotal - coalesce(discount_total, 0)) filter (where ${filter}), 0)`;
};
