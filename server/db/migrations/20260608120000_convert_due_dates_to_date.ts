import { Kysely, sql } from 'kysely';

// due_date is a calendar day, not a moment in time
// switching from timestamptz to date so it stops shifting across timezones

// also rename fulfilled_on to fulfilled_at to match the other event columns
// (transitioned_at, completed_at, created_at)

export async function up(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE orders ALTER COLUMN due_date TYPE date USING due_date::date`.execute(
		db,
	);
	await sql`ALTER TABLE production_batches ALTER COLUMN due_date TYPE date USING due_date::date`.execute(
		db,
	);

	await db.schema
		.alterTable('orders')
		.renameColumn('fulfilled_on', 'fulfilled_at')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('orders')
		.renameColumn('fulfilled_at', 'fulfilled_on')
		.execute();

	await sql`ALTER TABLE orders ALTER COLUMN due_date TYPE timestamptz USING due_date::timestamptz`.execute(
		db,
	);
	await sql`ALTER TABLE production_batches ALTER COLUMN due_date TYPE timestamptz USING due_date::timestamptz`.execute(
		db,
	);
}
