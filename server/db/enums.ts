// Column domains shared by the db types and the route contracts

export const ORDER_TYPE_VALUES = ['platform', 'custom', 'work'] as const;

export type OrderType = (typeof ORDER_TYPE_VALUES)[number];

// Audit trail event types
// Referenced as AuditAction.PiiSynced
export const AuditAction = {
	PiiSynced: 'pii_synced',
	CustomerRedacted: 'customer_redacted',
	StoreRemoved: 'store_removed',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
