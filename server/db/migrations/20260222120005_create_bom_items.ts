import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('bom_items')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('store_id', 'uuid', (col) =>
			col.references('stores.id').onDelete('cascade').notNull(),
		)
		.addColumn('material_type_id', 'uuid', (col) =>
			col.references('bom_material_types.id').onDelete('cascade').notNull(),
		)
		.addColumn('platform_sku', 'text', (col) => col.notNull())
		.addColumn('product_name', 'text', (col) => col.notNull())
		.addColumn('variant', 'text')
		.addColumn('piece', 'text', (col) => col.notNull())
		.addColumn('color', 'text')
		.addColumn('length', 'numeric')
		.addColumn('width', 'numeric')
		.addColumn('quantity', 'integer', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_bom_items_store_id')
		.on('bom_items')
		.column('store_id')
		.execute();

	await db.schema
		.createIndex('idx_bom_items_material_type_id')
		.on('bom_items')
		.column('material_type_id')
		.execute();

	await db.schema
		.createIndex('idx_bom_items_platform_sku')
		.on('bom_items')
		.column('platform_sku')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('bom_items').execute();
}
