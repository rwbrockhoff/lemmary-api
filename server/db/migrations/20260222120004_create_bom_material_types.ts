import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('bom_material_types')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('store_id', 'uuid', (col) =>
			col.references('stores.id').onDelete('cascade').notNull(),
		)
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('measurement', 'text', (col) => col.notNull())
		.addColumn('unit', 'text', (col) => col.notNull())
		.addColumn('tracks_color', 'boolean', (col) =>
			col.defaultTo(false).notNull(),
		)
		.addColumn('tracks_dimensions', 'boolean', (col) =>
			col.defaultTo(false).notNull(),
		)
		.addColumn('position', 'integer', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_bom_material_types_store_id')
		.on('bom_material_types')
		.column('store_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('bom_material_types').execute();
}
