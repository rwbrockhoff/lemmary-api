// Column domains shared by the db types and the route contracts

export const ORDER_TYPE_VALUES = [
	'platform',
	'custom',
	'work',
	'rework',
] as const;

export type OrderType = (typeof ORDER_TYPE_VALUES)[number];

// Reasons an order was reworked
export const REWORK_REASON_VALUES = [
	'missing_item',
	'wrong_item',
	'defect',
	'damaged_in_transit',
	'customer_change',
	'other',
] as const;

export type ReworkReason = (typeof REWORK_REASON_VALUES)[number];

// Whether a variant is built after the order or kept ready-made in stock
export const PRODUCTION_TYPE_VALUES = [
	'made_to_order',
	'ready_made',
	'dropship',
	'digital',
] as const;

export type ProductionType = (typeof PRODUCTION_TYPE_VALUES)[number];

// Audit trail event types
// Referenced as AuditAction.PiiSynced
export const AuditAction = {
	PiiSynced: 'pii_synced',
	CustomerRedacted: 'customer_redacted',
	StoreRemoved: 'store_removed',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

// Subscription statuses, normalized across providers
export const SUBSCRIPTION_STATUS_VALUES = [
	'pending',
	'active',
	'declined',
	'expired',
	'frozen',
	'cancelled',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];
