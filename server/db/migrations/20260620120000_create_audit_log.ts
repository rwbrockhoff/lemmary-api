import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('audit_log')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		// No FK on store_id/user_id so audit trail survives store or user deletion
		.addColumn('store_id', 'uuid', (col) => col.notNull())
		.addColumn('user_id', 'uuid')
		.addColumn('action', 'text', (col) => col.notNull())
		.addColumn('platform', 'text', (col) => col.notNull())
		.addColumn('resource_type', 'text')
		.addColumn('resource_id', 'text')
		.addColumn('metadata', 'jsonb')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_audit_log_store_id')
		.on('audit_log')
		.column('store_id')
		.execute();

	await db.schema
		.createIndex('idx_audit_log_platform')
		.on('audit_log')
		.column('platform')
		.execute();

	await db.schema
		.createIndex('idx_audit_log_created_at')
		.on('audit_log')
		.column('created_at')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('audit_log').execute();
}
