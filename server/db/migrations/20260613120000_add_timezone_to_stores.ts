import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('stores')
		.addColumn('timezone', 'text', (col) =>
			// Back fill and default to CO for client
			col.notNull().defaultTo('America/Denver'),
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('stores').dropColumn('timezone').execute();
}
