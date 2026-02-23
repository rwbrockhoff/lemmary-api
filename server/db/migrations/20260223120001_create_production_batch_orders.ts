import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('production_batch_orders')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('batch_id', 'uuid', (col) =>
			col.references('production_batches.id').onDelete('cascade').notNull(),
		)
		.addColumn('order_id', 'uuid', (col) =>
			col.references('orders.id').onDelete('cascade').notNull(),
		)
		.addColumn('completed', 'boolean', (col) =>
			col.defaultTo(false).notNull(),
		)
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_batch_orders_batch_id')
		.on('production_batch_orders')
		.column('batch_id')
		.execute();

	await db.schema
		.createIndex('idx_batch_orders_order_id')
		.on('production_batch_orders')
		.column('order_id')
		.execute();

	await db.schema
		.createIndex('idx_batch_orders_unique')
		.on('production_batch_orders')
		.columns(['batch_id', 'order_id'])
		.unique()
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('production_batch_orders').execute();
}
