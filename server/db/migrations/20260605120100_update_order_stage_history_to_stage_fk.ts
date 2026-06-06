import { Kysely, sql } from 'kysely';

// to_stage_id was ON DELETE SET NULL on a NOT NULL column
// updated to properly delete ON CASCADE

// app soft deletes by setting archived_at (timestamp)
// this is a data consistency fix in case we allow hard deletes later

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE order_stage_history
		DROP CONSTRAINT order_stage_history_to_stage_id_fkey,
		ADD CONSTRAINT order_stage_history_to_stage_id_fkey
			FOREIGN KEY (to_stage_id) REFERENCES order_workflow_stages (id)
			ON DELETE CASCADE
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE order_stage_history
		DROP CONSTRAINT order_stage_history_to_stage_id_fkey,
		ADD CONSTRAINT order_stage_history_to_stage_id_fkey
			FOREIGN KEY (to_stage_id) REFERENCES order_workflow_stages (id)
			ON DELETE SET NULL
	`.execute(db);
}
