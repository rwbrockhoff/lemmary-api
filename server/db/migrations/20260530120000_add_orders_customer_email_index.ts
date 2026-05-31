import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createIndex('idx_orders_store_customer_email')
		.on('orders')
		.columns(['store_id', 'customer_email'])
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('idx_orders_store_customer_email').execute();
}
