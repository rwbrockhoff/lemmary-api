import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('production_batch_order_items')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('batch_id', 'uuid', (col) =>
			col.references('production_batches.id').onDelete('cascade').notNull(),
		)
		.addColumn('batch_order_id', 'uuid', (col) =>
			col.references('production_batch_orders.id').onDelete('cascade').notNull(),
		)
		.addColumn('platform_sku', 'text')
		.addColumn('product_name', 'text', (col) => col.notNull())
		.addColumn('variant_label', 'jsonb')
		.addColumn('quantity', 'integer', (col) => col.notNull())
		.addColumn('completed', 'boolean', (col) =>
			col.defaultTo(false).notNull(),
		)
		.addColumn('completed_qty', 'integer', (col) =>
			col.defaultTo(0).notNull(),
		)
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_batch_order_items_batch_order_id')
		.on('production_batch_order_items')
		.column('batch_order_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('production_batch_order_items').execute();
}
