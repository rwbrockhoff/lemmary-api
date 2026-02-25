import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('order_item_workflow_stages')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('store_id', 'uuid', (col) =>
			col.references('stores.id').onDelete('cascade').notNull(),
		)
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('position', 'integer', (col) => col.notNull())
		.addColumn('color', 'text')
		.addColumn('is_default', 'boolean', (col) =>
			col.defaultTo(false).notNull(),
		)
		.addColumn('is_complete', 'boolean', (col) =>
			col.defaultTo(false).notNull(),
		)
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_order_item_workflow_stages_store_id')
		.on('order_item_workflow_stages')
		.column('store_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('order_item_workflow_stages').execute();
}
