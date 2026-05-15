import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('order_workflow_stages')
		.addColumn('archived_at', 'timestamptz')
		.execute();

	await db.schema
		.alterTable('order_item_workflow_stages')
		.addColumn('archived_at', 'timestamptz')
		.execute();

	await db.schema
		.createTable('order_stage_history')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('order_id', 'uuid', (col) =>
			col.references('orders.id').onDelete('cascade').notNull(),
		)
		.addColumn('from_stage_id', 'uuid', (col) =>
			col.references('order_workflow_stages.id').onDelete('set null'),
		)
		.addColumn('to_stage_id', 'uuid', (col) =>
			col.references('order_workflow_stages.id').onDelete('set null').notNull(),
		)
		.addColumn('transitioned_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_order_stage_history_order_id')
		.on('order_stage_history')
		.column('order_id')
		.execute();

	await db.schema
		.createIndex('idx_order_stage_history_to_stage_transitioned_at')
		.on('order_stage_history')
		.columns(['to_stage_id', 'transitioned_at'])
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('order_stage_history').execute();

	await db.schema
		.alterTable('order_item_workflow_stages')
		.dropColumn('archived_at')
		.execute();

	await db.schema
		.alterTable('order_workflow_stages')
		.dropColumn('archived_at')
		.execute();
}
