export const CUSTOMER_TIERS = ['new', 'loyal', 'super_fan'] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

// Single source of truth for tier thresholds. Used by /customers and the orders list.
export const computeCustomerTier = (orderCount: number): CustomerTier => {
	if (orderCount <= 1) return 'new';
	if (orderCount <= 4) return 'loyal';
	return 'super_fan';
};
