import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE UNIQUE INDEX idx_bom_material_types_unique
		ON bom_material_types (store_id, lower(name))
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('idx_bom_material_types_unique').execute();
}
