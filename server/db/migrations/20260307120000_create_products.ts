import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('products')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('store_id', 'uuid', (col) =>
			col.references('stores.id').onDelete('cascade').notNull(),
		)
		.addColumn('platform_product_id', 'text', (col) => col.notNull())
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('description', 'text')
		.addColumn('slug', 'text')
		.addColumn('is_visible', 'boolean', (col) => col.defaultTo(true).notNull())
		.addColumn('image_url', 'text')
		.addColumn('product_url', 'text')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_products_store_id')
		.on('products')
		.column('store_id')
		.execute();

	await db.schema
		.createIndex('idx_products_store_platform_id')
		.on('products')
		.columns(['store_id', 'platform_product_id'])
		.unique()
		.execute();

	await db.schema
		.createTable('product_variants')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('product_id', 'uuid', (col) =>
			col.references('products.id').onDelete('cascade').notNull(),
		)
		.addColumn('platform_variant_id', 'text', (col) => col.notNull())
		.addColumn('platform_sku', 'text')
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('price', 'numeric')
		.addColumn('sale_price', 'numeric')
		.addColumn('on_sale', 'boolean', (col) => col.defaultTo(false).notNull())
		.addColumn('stock_quantity', 'integer')
		.addColumn('stock_unlimited', 'boolean', (col) =>
			col.defaultTo(false).notNull(),
		)
		.addColumn('image_url', 'text')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_product_variants_product_id')
		.on('product_variants')
		.column('product_id')
		.execute();

	await db.schema
		.createIndex('idx_product_variants_product_platform_id')
		.on('product_variants')
		.columns(['product_id', 'platform_variant_id'])
		.unique()
		.execute();

	await db.schema
		.createIndex('idx_product_variants_sku')
		.on('product_variants')
		.column('platform_sku')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('product_variants').execute();
	await db.schema.dropTable('products').execute();
}
