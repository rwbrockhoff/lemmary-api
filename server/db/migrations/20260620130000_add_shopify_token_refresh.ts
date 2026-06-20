import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('stores')
		.addColumn('store_refresh_token', 'bytea')
		.addColumn('access_token_expires_at', 'timestamptz')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('stores')
		.dropColumn('store_refresh_token')
		.dropColumn('access_token_expires_at')
		.execute();
}
