import { Kysely, sql } from 'kysely';

// Adds the rework order type: a redo of a completed order, linked to the original.
// Reworks move through production but don't count as revenue.

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('orders')
		.dropConstraint('orders_order_type_check')
		.execute();

	await db.schema
		.alterTable('orders')
		.addCheckConstraint(
			'orders_order_type_check',
			sql`order_type in ('platform', 'custom', 'work', 'rework')`,
		)
		.execute();

	await db.schema
		.alterTable('orders')
		.addColumn('parent_order_id', 'uuid', (col) =>
			col.references('orders.id').onDelete('set null'),
		)
		.addColumn('rework_reason', 'text')
		.execute();

	await db.schema
		.createIndex('idx_orders_parent_order_id')
		.on('orders')
		.column('parent_order_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	// Rework orders can't exist without the type, so drop them before restoring the constraint
	await db.deleteFrom('orders').where('order_type', '=', 'rework').execute();

	await db.schema.dropIndex('idx_orders_parent_order_id').execute();

	await db.schema
		.alterTable('orders')
		.dropColumn('parent_order_id')
		.dropColumn('rework_reason')
		.execute();

	await db.schema
		.alterTable('orders')
		.dropConstraint('orders_order_type_check')
		.execute();

	await db.schema
		.alterTable('orders')
		.addCheckConstraint(
			'orders_order_type_check',
			sql`order_type in ('platform', 'custom', 'work')`,
		)
		.execute();
}
