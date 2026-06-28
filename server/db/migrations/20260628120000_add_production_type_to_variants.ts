import { Kysely, sql } from 'kysely';

// Adds production_type per variant so not every item is treated as made-to-order

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('product_variants')
		.addColumn('production_type', 'text', (col) =>
			col.defaultTo('made_to_order').notNull(),
		)
		.execute();

	await db.schema
		.alterTable('product_variants')
		.addCheckConstraint(
			'product_variants_production_type_check',
			sql`production_type in ('made_to_order', 'ready_made', 'dropship', 'digital')`,
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('product_variants')
		.dropColumn('production_type')
		.execute();
}
