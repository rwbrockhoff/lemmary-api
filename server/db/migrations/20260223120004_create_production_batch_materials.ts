import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('production_batch_materials')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('batch_id', 'uuid', (col) =>
			col.references('production_batches.id').onDelete('cascade').notNull(),
		)
		.addColumn('category', 'text', (col) => col.notNull())
		.addColumn('material_type', 'text')
		.addColumn('piece', 'text', (col) => col.notNull())
		.addColumn('color', 'text')
		.addColumn('width', 'numeric')
		.addColumn('quantity', 'numeric', (col) => col.notNull())
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
		.createIndex('idx_batch_materials_batch_id')
		.on('production_batch_materials')
		.column('batch_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('production_batch_materials').execute();
}
