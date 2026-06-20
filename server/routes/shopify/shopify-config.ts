export const SHOPIFY_SCOPES = [
	'read_orders',
	'read_products',
	'read_customers',
];
export const SHOPIFY_API_VERSION = '2026-01';
export const SHOPIFY_STATE_COOKIE = 'shopify_oauth_state';
export const SHOPIFY_CALLBACK_PATH = '/auth/shopify/callback';

// Shopify signs webhooks with this header
export const SHOPIFY_WEBHOOK_HMAC_HEADER = 'x-shopify-hmac-sha256';

// Compliance webhook endpoints (setup in the app settings)
export const SHOPIFY_WEBHOOK_PATHS = {
	shopRedact: '/webhooks/shopify/shop/redact',
	customersRedact: '/webhooks/shopify/customers/redact',
	customersDataRequest: '/webhooks/shopify/customers/data-request',
} as const;
