import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('stores')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('user_id', 'uuid', (col) =>
			col.references('users.id').onDelete('cascade').notNull(),
		)
		.addColumn('platform', 'text', (col) => col.notNull())
		.addColumn('store_name', 'text', (col) => col.notNull())
		.addColumn('api_key', 'text', (col) => col.notNull())
		.addColumn('platform_config', 'jsonb')
		.addColumn('last_synced_at', 'timestamptz')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	await db.schema
		.createIndex('idx_stores_user_id')
		.on('stores')
		.column('user_id')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('stores').execute();
}
