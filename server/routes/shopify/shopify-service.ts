import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/environment.js';
import { SHOPIFY_SCOPES, SHOPIFY_CALLBACK_PATH } from './shopify-config.js';
import { shopifyGraphql } from './shopify-graphql.js';

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

export type ShopifyTokens = {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
};

type TokenResponse = {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
};

function parseTokens(data: TokenResponse): ShopifyTokens | null {
	if (!data.access_token || !data.refresh_token || data.expires_in == null) {
		return null;
	}
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresIn: data.expires_in,
	};
}

// Trade the temp code from Shopify for access token
// expiring: 1 asks for the expiring token + refresh token
export async function exchangeCodeForToken(
	shop: string,
	code: string,
): Promise<ShopifyTokens | null> {
	const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			client_id: env.SHOPIFY_CLIENT_ID,
			client_secret: env.SHOPIFY_CLIENT_SECRET,
			code,
			expiring: 1,
		}),
	});

	if (!response.ok) return null;

	return parseTokens((await response.json()) as TokenResponse);
}

// Swap refresh token for fresh access token (and new refresh token)
export async function refreshShopifyToken(
	shop: string,
	refreshToken: string,
): Promise<ShopifyTokens | null> {
	const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			client_id: env.SHOPIFY_CLIENT_ID,
			client_secret: env.SHOPIFY_CLIENT_SECRET,
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		}),
	});

	if (!response.ok) return null;

	return parseTokens((await response.json()) as TokenResponse);
}

const SHOP_TIMEZONE_QUERY = `query { shop { ianaTimezone } }`;

export async function fetchShopTimezone(
	shop: string,
	token: string,
): Promise<string | null> {
	try {
		const data = await shopifyGraphql<{ shop: { ianaTimezone: string } }>(
			shop,
			token,
			SHOP_TIMEZONE_QUERY,
			{},
		);
		return data.shop.ianaTimezone ?? null;
	} catch {
		return null;
	}
}

const SHOP_EMAIL_QUERY = `query { shop { email } }`;

// Shop contact email for creating an account on a fresh install
export async function fetchShopEmail(
	shop: string,
	token: string,
): Promise<string | null> {
	try {
		const data = await shopifyGraphql<{ shop: { email: string } }>(
			shop,
			token,
			SHOP_EMAIL_QUERY,
			{},
		);
		return data.shop.email ?? null;
	} catch {
		return null;
	}
}
