import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('production_batches')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('store_id', 'uuid', (col) =>
			col.references('stores.id').onDelete('cascade').notNull(),
		)
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('status', 'text', (col) =>
			col.defaultTo('active').notNull(),
		)
		.addColumn('completed_at', 'timestamptz')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_production_batches_store_id')
		.on('production_batches')
		.column('store_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('production_batches').execute();
}
