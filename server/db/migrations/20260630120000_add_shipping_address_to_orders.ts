import { Kysely } from 'kysely';

// Keeps the shipping address from the platform so packing slips can show ship to

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('orders')
		.addColumn('shipping_address', 'jsonb')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('orders').dropColumn('shipping_address').execute();
}
