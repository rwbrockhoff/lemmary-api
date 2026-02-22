import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('order_items')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('order_id', 'uuid', (col) =>
			col.references('orders.id').onDelete('cascade').notNull(),
		)
		.addColumn('platform_sku', 'text')
		.addColumn('product_name', 'text', (col) => col.notNull())
		.addColumn('variant_label', 'text')
		.addColumn('quantity', 'integer', (col) => col.notNull())
		.addColumn('unit_price', 'numeric')
		.addColumn('image_url', 'text')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_order_items_order_id')
		.on('order_items')
		.column('order_id')
		.execute();

	await db.schema
		.createIndex('idx_order_items_platform_sku')
		.on('order_items')
		.column('platform_sku')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('order_items').execute();
}
