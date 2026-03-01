import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('orders')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('store_id', 'uuid', (col) =>
			col.references('stores.id').onDelete('cascade').notNull(),
		)
		.addColumn('platform_order_id', 'text', (col) => col.notNull())
		.addColumn('order_number', 'text', (col) => col.notNull())
		.addColumn('customer_name', 'text', (col) => col.notNull())
		.addColumn('customer_email', 'text')
		.addColumn('order_date', 'timestamptz', (col) => col.notNull())
		.addColumn('fulfillment_status', 'text', (col) =>
			col.defaultTo('pending').notNull(),
		)
		.addColumn('subtotal', 'numeric')
		.addColumn('shipping_total', 'numeric')
		.addColumn('grand_total', 'numeric')
		.addColumn('workflow_stage_id', 'uuid', (col) =>
			col.references('order_workflow_stages.id').onDelete('set null'),
		)
		.addColumn('due_date', 'timestamptz')
		.addColumn('shipping_method', 'text')
		.addColumn('order_notes', 'text')
		.addColumn('order_url', 'text')
		.addColumn('currency', 'text', (col) => col.defaultTo('USD').notNull())
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_orders_store_id')
		.on('orders')
		.column('store_id')
		.execute();

	await db.schema
		.createIndex('idx_orders_store_platform_id')
		.on('orders')
		.columns(['store_id', 'platform_order_id'])
		.unique()
		.execute();

	await db.schema
		.createIndex('idx_orders_order_date')
		.on('orders')
		.column('order_date')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('orders').execute();
}
