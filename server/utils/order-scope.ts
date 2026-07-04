import { sql } from 'kysely';

// platform and custom are sales. work and rework are internal, no revenue
export const SALES_ORDER_TYPES = ['platform', 'custom'] as const;

// same list as a SQL fragment for raw queries
export const salesOrderTypesSql = sql`(${sql.join(
	SALES_ORDER_TYPES.map((type) => sql.lit(type)),
)})`;
