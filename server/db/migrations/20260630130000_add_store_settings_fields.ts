import { Kysely, sql } from 'kysely';

// Store slip branding plus the default production type for new variants

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('stores')
		.addColumn('logo_url', 'text')
		.addColumn('tagline', 'text')
		.addColumn('website_url', 'text')
		.addColumn('contact_email', 'text')
		.addColumn('default_production_type', 'text', (col) =>
			col.defaultTo('ready_made').notNull(),
		)
		.execute();

	await db.schema
		.alterTable('stores')
		.addCheckConstraint(
			'stores_default_production_type_check',
			sql`default_production_type in ('made_to_order', 'ready_made', 'dropship', 'digital')`,
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('stores')
		.dropColumn('logo_url')
		.dropColumn('tagline')
		.dropColumn('website_url')
		.dropColumn('contact_email')
		.dropColumn('default_production_type')
		.execute();
}
