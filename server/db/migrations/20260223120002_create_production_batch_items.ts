import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('production_batch_items')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('batch_id', 'uuid', (col) =>
			col.references('production_batches.id').onDelete('cascade').notNull(),
		)
		.addColumn('platform_sku', 'text')
		.addColumn('product_name', 'text', (col) => col.notNull())
		.addColumn('variant_label', 'text')
		.addColumn('quantity', 'integer', (col) => col.notNull())
		.addColumn('completed', 'boolean', (col) =>
			col.defaultTo(false).notNull(),
		)
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_batch_items_batch_id')
		.on('production_batch_items')
		.column('batch_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('production_batch_items').execute();
}
