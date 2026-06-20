import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/environment.js';
import { SHOPIFY_SCOPES, SHOPIFY_CALLBACK_PATH } from './shopify-config.js';

export function buildAuthorizeUrl(shop: string, state: string): string {
	const params = new URLSearchParams({
		client_id: env.SHOPIFY_CLIENT_ID ?? '',
		scope: SHOPIFY_SCOPES.join(','),
		redirect_uri: `${env.API_URL}${SHOPIFY_CALLBACK_PATH}`,
		state,
	});

	return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

// Shopify signs every callback using our secret app key so we can trust it.
// We rebuild that same signature from the params Shopify sent and check it matches.
// If it does, the request came from Shopify and nothing was changed on the way
// Signature is an HMAC signature
// We read the raw query so nothing gets dropped.
export function verifyHmac(rawQuery: string): boolean {
	const secret = env.SHOPIFY_CLIENT_SECRET;
	if (!secret) return false;

	// Pull off the signature Shopify sent, then rebuild the message from the rest
	// of the params (sorted, the same way Shopify builds it) so we can sign it too.
	const params = new URLSearchParams(rawQuery);
	const hmac = params.get('hmac');
	if (!hmac) return false;
	params.delete('hmac');

	const message = [...params.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`)
		.join('&');

	// Sign the message with our secret and compare it against Shopify's signature
	const digest = createHmac('sha256', secret).update(message).digest('hex');
	const expected = Buffer.from(digest, 'utf8');
	const received = Buffer.from(hmac, 'utf8');

	return (
		expected.length === received.length && timingSafeEqual(expected, received)
	);
}

// Trade the temp code Shopify handed us for a long-lived access token
// This token is what lets us pull the orders and products from here on
export async function exchangeCodeForToken(
	shop: string,
	code: string,
): Promise<string | null> {
	const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			client_id: env.SHOPIFY_CLIENT_ID,
			client_secret: env.SHOPIFY_CLIENT_SECRET,
			code,
		}),
	});

	if (!response.ok) return null;

	const data = (await response.json()) as { access_token?: string };
	return data.access_token ?? null;
}
