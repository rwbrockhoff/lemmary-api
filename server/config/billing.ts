export const SHOPIFY_PLAN = {
	name: 'Lemmary',
	price: '19.00',
	currencyCode: 'USD',
	interval: 'EVERY_30_DAYS',
	trialDays: 7,
} as const;

// Stripe's recurring price + interval live in Stripe Price (STRIPE_PRICE_ID)
export const STRIPE_PLAN = {
	name: 'Lemmary',
	price: '19.00',
	currency: 'USD',
	trialDays: 7,
} as const;
