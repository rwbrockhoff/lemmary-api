import { Kysely, sql } from 'kysely';

// Adds order_type (platform/custom/work) so orders aren't limited to the platform sync.
// Custom and work orders have no platform_order_id, so that field and customer_name go
// nullable and the unique index becomes partial.

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('orders')
		.addColumn('order_type', 'text', (col) =>
			col.defaultTo('platform').notNull(),
		)
		.addColumn('order_title', 'text')
		.addColumn('order_description', 'text')
		.execute();

	await db.schema
		.alterTable('orders')
		.addCheckConstraint(
			'orders_order_type_check',
			sql`order_type in ('platform', 'custom', 'work')`,
		)
		.execute();

	await db.schema
		.alterTable('orders')
		.alterColumn('customer_name', (col) => col.dropNotNull())
		.execute();

	await db.schema
		.alterTable('orders')
		.alterColumn('platform_order_id', (col) => col.dropNotNull())
		.execute();

	await db.schema.dropIndex('idx_orders_store_platform_id').execute();

	await sql`
		CREATE UNIQUE INDEX idx_orders_store_platform_id
		ON orders (store_id, platform_order_id)
		WHERE platform_order_id IS NOT NULL
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	// Custom and work orders can't exist without order_type, so drop them before
	// restoring the platform-only NOT NULL and unique constraints.
	await db.deleteFrom('orders').where('order_type', '!=', 'platform').execute();

	await db.schema.dropIndex('idx_orders_store_platform_id').execute();

	await db.schema
		.createIndex('idx_orders_store_platform_id')
		.on('orders')
		.columns(['store_id', 'platform_order_id'])
		.unique()
		.execute();

	await db.schema
		.alterTable('orders')
		.alterColumn('platform_order_id', (col) => col.setNotNull())
		.execute();

	await db.schema
		.alterTable('orders')
		.alterColumn('customer_name', (col) => col.setNotNull())
		.execute();

	await db.schema
		.alterTable('orders')
		.dropColumn('order_type')
		.dropColumn('order_title')
		.dropColumn('order_description')
		.execute();
}
