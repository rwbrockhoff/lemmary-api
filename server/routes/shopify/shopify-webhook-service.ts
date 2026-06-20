import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '../../db/connection.js';
import { env } from '../../config/environment.js';
import { getStoreByShopDomain } from '../../utils/store.js';
import { recordAuditEvent } from '../../utils/audit-logger.js';
import { AuditAction } from '../../db/enums.js';

// Shopify signs webhook with HMAC over the raw request body using our app secret
// Separate from the OAuth flow (signs query params as hex)
export function verifyWebhookHmac(
	rawBody: string | Buffer,
	hmacHeader: string | undefined,
): boolean {
	const secret = env.SHOPIFY_CLIENT_SECRET;
	if (!secret || !hmacHeader) return false;

	// Compare against the exact bytes Shopify sent
	const digest = createHmac('sha256', secret).update(rawBody).digest('base64');
	const expected = Buffer.from(digest);
	const received = Buffer.from(hmacHeader);

	// Constant time compare so timing doesn't leak # of bytes matched
	// timingSafeEqual throws on length mismatch, so check length first
	return (
		expected.length === received.length && timingSafeEqual(expected, received)
	);
}

export type ShopRedactPayload = {
	shop_id: number;
	shop_domain: string;
};

export type CustomerRedactPayload = {
	shop_domain: string;
	customer: { id?: number; email?: string };
	orders_to_redact?: number[];
};

export type CustomerDataRequestPayload = {
	shop_domain: string;
	customer: { id?: number; email?: string };
	orders_requested?: number[];
	data_request?: { id?: number };
};

// Clears personal info we store on a customer's orders (name + email)
// order_items hold no customer data, so only affects orders
export async function redactCustomerData(
	shop: string,
	email: string,
	customerId?: number,
): Promise<number> {
	const store = await getStoreByShopDomain(shop);
	if (!store) return 0;

	return db.transaction().execute(async (trx) => {
		const result = await trx
			.updateTable('orders')
			.set({
				customer_name: '[redacted]',
				customer_email: null,
				updated_at: new Date(),
			})
			.where('store_id', '=', store.id)
			.where('customer_email', '=', email)
			.executeTakeFirst();

		const redacted = Number(result.numUpdatedRows);

		// Save to audit log
		// Reference customer by Shopify id, never email we just cleared
		await recordAuditEvent(
			{
				action: AuditAction.CustomerRedacted,
				platform: store.platform,
				storeId: store.id,
				resourceType: 'customer',
				resourceId: customerId != null ? String(customerId) : null,
				metadata: { orders: redacted },
			},
			trx,
		);

		return redacted;
	});
}
