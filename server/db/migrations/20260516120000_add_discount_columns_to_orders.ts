import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('orders')
		.addColumn('promo_code', 'text')
		.addColumn('discount_total', 'numeric(10, 2)', (col) =>
			col.defaultTo(sql`0`),
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('orders')
		.dropColumn('promo_code')
		.dropColumn('discount_total')
		.execute();
}
