import { type Kysely } from 'kysely';
import { db } from '../db/connection.js';
import { toJsonb } from './json.js';
import type { Database } from '../db/database-types.js';
import type { AuditAction } from '../db/enums.js';

type Platform = 'squarespace' | 'shopify' | 'etsy';

type AuditEntry = {
	action: AuditAction;
	platform: Platform;
	storeId: string;
	userId?: string | null;
	resourceType?: string | null;
	resourceId?: string | null;
	metadata?: Record<string, unknown> | null;
};

// PII audit trail: separate from our regular logs
// Pass the trx so row saves with change (or not at all)
export async function recordAuditEvent(
	entry: AuditEntry,
	trx: Kysely<Database> = db,
): Promise<void> {
	await trx
		.insertInto('audit_log')
		.values({
			action: entry.action,
			platform: entry.platform,
			store_id: entry.storeId,
			user_id: entry.userId ?? null,
			resource_type: entry.resourceType ?? null,
			resource_id: entry.resourceId ?? null,
			metadata: toJsonb(entry.metadata ?? null),
		})
		.execute();
}
