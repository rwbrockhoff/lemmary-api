import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('subscriptions')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		// One subscription per store, removed with the store
		.addColumn('store_id', 'uuid', (col) =>
			col.notNull().unique().references('stores.id').onDelete('cascade'),
		)
		.addColumn('provider', 'text', (col) => col.notNull())
		.addColumn('provider_subscription_id', 'text')
		.addColumn('provider_customer_id', 'text')
		.addColumn('status', 'text', (col) => col.notNull())
		.addColumn('plan_name', 'text', (col) => col.notNull())
		.addColumn('price', 'numeric', (col) => col.notNull())
		.addColumn('currency', 'text', (col) => col.notNull().defaultTo('USD'))
		.addColumn('trial_ends_at', 'timestamptz')
		.addColumn('current_period_end', 'timestamptz')
		.addColumn('cancel_at_period_end', 'boolean', (col) =>
			col.notNull().defaultTo(false),
		)
		// Provider-specific fields live here so adding Stripe needs no migration
		.addColumn('metadata', 'jsonb')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();

	// Webhooks arrive with the provider's subscription id, so we look up by it
	await db.schema
		.createIndex('idx_subscriptions_provider_subscription_id')
		.on('subscriptions')
		.column('provider_subscription_id')
		.execute();

	// Free access we grant directly (owner, partners, ambassadors)
	await db.schema
		.createTable('account_grants')
		.addColumn('id', 'uuid', (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn('user_id', 'uuid', (col) =>
			col.notNull().unique().references('users.id').onDelete('cascade'),
		)
		.addColumn('note', 'text')
		// Null means it never expires
		.addColumn('expires_at', 'timestamptz')
		.addColumn('created_at', 'timestamptz', (col) =>
			col.defaultTo(sql`now()`).notNull(),
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('account_grants').execute();
	await db.schema.dropTable('subscriptions').execute();
}
