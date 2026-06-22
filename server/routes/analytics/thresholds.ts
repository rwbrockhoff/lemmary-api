// Minimum data each chart needs before we show it instead of an empty state

// Performance list charts are two-fold:
// - Enough records (customers/orders) to be meaningful
// - Enough rows to render without looking partial/empty
export const PERFORMANCE_MINIMUMS = {
	stageBottleneck: { transitions: 5, stages: 3 },
	topProducts: { orders: 5, products: 3 },
	materialConsumption: { orders: 5, materials: 3 },
	customerMix: { customers: 5 },
	couponUsage: { orders: 5 },
	onTimeDelivery: { fulfilledOrders: 5 },
} as const;

// Dashboard orders/AOV: minimum points so the line doesn't look empty
export const OPERATIONS_MINIMUMS = {
	ordersTrend: 4,
} as const;
