import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('users')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('email', 'text', (col) => col.notNull().unique())
		.addColumn('full_name', 'text', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('users').execute();
}
