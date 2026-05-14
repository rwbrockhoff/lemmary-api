import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	const encryptionKey = process.env.STORE_ENCRYPTION_KEY;
	if (!encryptionKey) {
		throw new Error('STORE_ENCRYPTION_KEY must be set to run this migration');
	}

	await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

	await db.schema
		.alterTable('stores')
		.addColumn('store_access_token', 'bytea')
		.execute();

	await sql`
		UPDATE stores
		SET store_access_token = pgp_sym_encrypt(api_key, ${encryptionKey})
		WHERE api_key IS NOT NULL
	`.execute(db);

	await db.schema.alterTable('stores').dropColumn('api_key').execute();

	await db.schema
		.alterTable('stores')
		.alterColumn('store_access_token', (col) => col.setNotNull())
		.execute();

	await db.schema.alterTable('orders').dropColumn('order_url').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	const encryptionKey = process.env.STORE_ENCRYPTION_KEY;
	if (!encryptionKey) {
		throw new Error(
			'STORE_ENCRYPTION_KEY must be set to roll back this migration',
		);
	}

	await db.schema.alterTable('orders').addColumn('order_url', 'text').execute();

	await db.schema.alterTable('stores').addColumn('api_key', 'text').execute();

	await sql`
		UPDATE stores
		SET api_key = pgp_sym_decrypt(store_access_token, ${encryptionKey})
		WHERE store_access_token IS NOT NULL
	`.execute(db);

	await db.schema
		.alterTable('stores')
		.alterColumn('api_key', (col) => col.setNotNull())
		.execute();

	await db.schema
		.alterTable('stores')
		.dropColumn('store_access_token')
		.execute();
}
