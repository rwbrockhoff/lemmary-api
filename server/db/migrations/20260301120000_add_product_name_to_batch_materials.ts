import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('production_batch_materials')
		.addColumn('product_name', 'text')
		.execute();

	await db.schema
		.alterTable('production_batches')
		.addColumn('due_date', 'timestamptz')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('production_batch_materials')
		.dropColumn('product_name')
		.execute();

	await db.schema
		.alterTable('production_batches')
		.dropColumn('due_date')
		.execute();
}
