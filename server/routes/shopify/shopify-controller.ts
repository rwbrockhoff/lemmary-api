import { randomBytes } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../../utils/app-error.js';
import { env } from '../../config/environment.js';
import {
	buildAuthorizeUrl,
	verifyHmac,
	exchangeCodeForToken,
} from './shopify-service.js';
import { createShopifyStore } from '../store/store-service.js';
import { SHOPIFY_STATE_COOKIE } from './shopify-config.js';

export async function handleShopifyConnect(
	request: FastifyRequest<{ Querystring: { shop: string } }>,
	reply: FastifyReply,
) {
	if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) {
		throw AppError.badRequest('Shopify is not configured.');
	}

	const nonce = randomBytes(16).toString('hex');

	// Carry the user through the redirect via a signed cookie so the callback
	// doesn't depend on the auth cookie surviving Shopify's redirect
	reply.setCookie(
		SHOPIFY_STATE_COOKIE,
		JSON.stringify({ nonce, userId: request.userId }),
		{
			httpOnly: true,
			secure: env.NODE_ENV === 'production',
			sameSite: 'lax',
			signed: true,
			path: '/',
			maxAge: 600, // 10 minutes, short-lived for the auth flow duration
		},
	);

	return reply.redirect(buildAuthorizeUrl(request.query.shop, nonce));
}

type ShopifyCallbackQuery = {
	code: string;
	shop: string;
	state: string;
	hmac: string;
};

// Shopify sends the merchant back here after they approve our app. We make sure
// the request is authentic, trade the temp code for an access token, and create their store.
// Any problem along the way just bounces them back to connect with an error.
export async function handleShopifyCallback(
	request: FastifyRequest<{ Querystring: ShopifyCallbackQuery }>,
	reply: FastifyReply,
) {
	// On any problem, log why and bounce back to connect with an error flag
	const fail = (reason: string) => {
		request.log.warn(`Shopify connect failed: ${reason}`);
		return reply.redirect(`${env.FRONTEND_URL}/connect-store?error=shopify`);
	};

	// Read + clear the cookie we set when the connect flow started
	// It holds the one-time value (nonce) + which user kicked off the connect
	const cookie = request.cookies[SHOPIFY_STATE_COOKIE];
	reply.clearCookie(SHOPIFY_STATE_COOKIE, { path: '/' });

	const unsigned = cookie ? request.unsignCookie(cookie) : null;
	if (!unsigned?.valid || !unsigned.value) return fail('missing state cookie');

	let parsed: { nonce: string; userId: string };
	try {
		parsed = JSON.parse(unsigned.value);
	} catch {
		return fail('unreadable state cookie');
	}

	const { code, shop, state } = request.query;
	const rawQuery = request.raw.url?.split('?')[1] ?? '';

	// The value Shopify echoes back must match the one in our cookie
	// otherewise, someone could try to connect a store on a user's behalf (forged attempt)
	if (state !== parsed.nonce) return fail('state mismatch');

	// Confirm the request actually came from Shopify and wasn't tampered
	if (!verifyHmac(rawQuery)) return fail('hmac check failed');

	// Swap the temp code for a real access token we can use to read their store
	const token = await exchangeCodeForToken(shop, code);
	if (!token) return fail('token exchange failed');

	// Create store with the token (and seed default workflow stages).
	const result = await createShopifyStore(parsed.userId, shop, token);
	if (!result.ok) return fail(`store creation failed (${result.error})`);

	return reply.redirect(`${env.FRONTEND_URL}/`);
}
