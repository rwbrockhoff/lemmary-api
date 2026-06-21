import { randomBytes } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../../utils/app-error.js';
import { env } from '../../config/environment.js';
import { REFRESH_TOKEN_COOKIE } from '../../config/constants.js';
import { refreshCookieOptions } from '../../utils/cookies.js';
import {
	buildAuthorizeUrl,
	verifyHmac,
	exchangeCodeForToken,
	fetchShopEmail,
} from './shopify-service.js';
import {
	findOrCreateUserByEmail,
	createSession,
} from '../auth/auth-service.js';
import { createShopifyStore } from '../store/store-service.js';
import { SHOPIFY_STATE_COOKIE } from './shopify-config.js';

// Temp, 30 min
const STATE_COOKIE_MAX_AGE = 60 * 30;

function stateCookieOptions(maxAge: number) {
	return {
		httpOnly: true,
		secure: env.NODE_ENV === 'production',
		sameSite: 'lax' as const,
		signed: true,
		path: '/',
		maxAge,
	};
}

// Our "Connect Shopify" button sends the user here
export async function handleShopifyStart(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	if (!env.SHOPIFY_INSTALL_URL) {
		throw AppError.badRequest('Shopify install is not configured.');
	}

	// Stash who's connecting so callback can attach store
	reply.setCookie(
		SHOPIFY_STATE_COOKIE,
		JSON.stringify({ userId: request.userId ?? null }),
		stateCookieOptions(STATE_COOKIE_MAX_AGE),
	);

	return reply.redirect(env.SHOPIFY_INSTALL_URL);
}

// Shopify sends merchant here to begin install with shop attached
export async function handleShopifyInstall(
	request: FastifyRequest<{ Querystring: { shop: string } }>,
	reply: FastifyReply,
) {
	if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) {
		throw AppError.badRequest('Shopify is not configured.');
	}

	// Make sure request came from Shopify
	const rawQuery = request.raw.url?.split('?')[1] ?? '';
	if (!verifyHmac(rawQuery)) {
		request.log.warn('Shopify install hmac check failed');
		return reply.redirect(`${env.FRONTEND_URL}/connect-store?error=shopify`);
	}

	// Pick up connecting user if our button stashed one
	// External/app store installs straight from Shopify won't have one
	const cookie = request.cookies[SHOPIFY_STATE_COOKIE];
	const unsigned = cookie ? request.unsignCookie(cookie) : null;
	let userId: string | null = null;
	if (unsigned?.valid && unsigned.value) {
		try {
			userId = (JSON.parse(unsigned.value).userId as string | null) ?? null;
		} catch {
			userId = null;
		}
	}

	const nonce = randomBytes(16).toString('hex');
	reply.setCookie(
		SHOPIFY_STATE_COOKIE,
		JSON.stringify({ nonce, userId }),
		stateCookieOptions(STATE_COOKIE_MAX_AGE),
	);

	return reply.redirect(buildAuthorizeUrl(request.query.shop, nonce));
}

type ShopifyCallbackQuery = {
	code: string;
	shop: string;
	state: string;
	hmac: string;
};

// Shopify sends merchant back here after they approve our app
export async function handleShopifyCallback(
	request: FastifyRequest<{ Querystring: ShopifyCallbackQuery }>,
	reply: FastifyReply,
) {
	// Bounce back to connect with an error flag on any failure
	const fail = (reason: string) => {
		request.log.warn(`Shopify connect failed: ${reason}`);
		return reply.redirect(`${env.FRONTEND_URL}/connect-store?error=shopify`);
	};

	// Read + clear state we set when the install started
	const cookie = request.cookies[SHOPIFY_STATE_COOKIE];
	reply.clearCookie(SHOPIFY_STATE_COOKIE, { path: '/' });

	const unsigned = cookie ? request.unsignCookie(cookie) : null;
	if (!unsigned?.valid || !unsigned.value) return fail('missing state cookie');

	let parsed: { nonce: string; userId: string | null };
	try {
		parsed = JSON.parse(unsigned.value);
	} catch {
		return fail('unreadable state cookie');
	}

	const { code, shop, state } = request.query;
	const rawQuery = request.raw.url?.split('?')[1] ?? '';

	// The value must match our nonce
	if (state !== parsed.nonce) return fail('state mismatch');

	// Confirm it came from Shopify / no tampering
	if (!verifyHmac(rawQuery)) return fail('hmac check failed');

	// Trade temp code for the access + refresh tokens
	const tokens = await exchangeCodeForToken(shop, code);
	if (!tokens) return fail('token exchange failed');

	let userId = parsed.userId;
	let sessionToken: string | null = null;

	// Externall install: so look up by shop email and sign in
	if (!userId) {
		const email = await fetchShopEmail(shop, tokens.accessToken);
		if (!email) return fail('shop email unavailable');
		try {
			userId = await findOrCreateUserByEmail(email);
			sessionToken = await createSession(email);
		} catch (err) {
			request.log.error(err, 'Shopify sign-in failed');
			return fail('sign-in failed');
		}
	}

	const result = await createShopifyStore(userId, shop, tokens);
	if (!result.ok) return fail(`store creation failed (${result.error})`);

	// New accounts get signed in here - existing users keep session
	if (sessionToken) {
		reply.setCookie(REFRESH_TOKEN_COOKIE, sessionToken, refreshCookieOptions);
	}

	return reply.redirect(`${env.FRONTEND_URL}/?connected=shopify`);
}
