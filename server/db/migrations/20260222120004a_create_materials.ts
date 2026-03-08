import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('materials')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('store_id', 'uuid', (col) =>
			col.references('stores.id').onDelete('cascade').notNull(),
		)
		.addColumn('material_type_id', 'uuid', (col) =>
			col
				.references('bom_material_types.id')
				.onDelete('cascade')
				.notNull(),
		)
		.addColumn('color', 'text')
		.addColumn('size', 'text')
		.addColumn('purchase_url', 'text')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_materials_store_id')
		.on('materials')
		.column('store_id')
		.execute();

	await db.schema
		.createIndex('idx_materials_material_type_id')
		.on('materials')
		.column('material_type_id')
		.execute();

	await db.schema
		.createIndex('idx_materials_unique')
		.on('materials')
		.columns(['store_id', 'material_type_id', 'color', 'size'])
		.unique()
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('materials').execute();
}
