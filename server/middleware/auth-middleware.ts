import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	REFRESH_TOKEN_COOKIE,
	DEMO_SESSION_TOKEN,
	DEMO_USER_ID,
	TEST_AUTH_HEADER,
} from '../config/constants.js';
import { env } from '../config/environment.js';
import { authenticateRefreshToken } from '../routes/auth/auth-service.js';
import {
	refreshCookieOptions,
	clearRefreshCookieOptions,
} from '../utils/cookies.js';

const PUBLIC_ROUTES = [
	'/auth/register',
	'/auth/login',
	'/auth/demo',
	'/auth/logout',
	'/auth/forgot-password',
	'/auth/reset-password',
	'/auth/oauth/session',
	'/auth/status',
	'/auth/shopify/callback',
	'/health',
];

const PUBLIC_ROUTE_PREFIXES = ['/api-docs', '/docs'];

const DEMO_WRITE_ALLOWLIST = ['/auth/logout'];

export async function authMiddleware(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	// Handle auth in testing environment
	if (env.NODE_ENV === 'test') {
		const testUserId = request.headers[TEST_AUTH_HEADER];
		if (typeof testUserId === 'string') {
			request.userId = testUserId;
			return;
		}
	}

	const signedCookie = request.cookies[REFRESH_TOKEN_COOKIE];
	if (signedCookie) {
		const unsigned = request.unsignCookie(signedCookie);
		if (unsigned.valid && unsigned.value) {
			if (unsigned.value === DEMO_SESSION_TOKEN) {
				request.userId = DEMO_USER_ID;
			} else {
				const result = await authenticateRefreshToken(unsigned.value);
				if (result.success) {
					request.userId = result.userId;
					if (result.newRefreshToken) {
						reply.setCookie(
							REFRESH_TOKEN_COOKIE,
							result.newRefreshToken,
							refreshCookieOptions,
						);
					}
				} else {
					reply.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshCookieOptions);
				}
			}
		}
	}

	// dev fallback — uncomment to skip auth in local dev
	// if (!request.userId && env.NODE_ENV === 'development') {
	// 	request.userId = DEV_USER_ID;
	// }

	const pathname = request.url.split('?')[0];

	if (PUBLIC_ROUTES.includes(pathname)) return;

	if (PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		return;
	}

	if (!request.userId) {
		return reply.status(401).send({ error: 'Unauthorized' });
	}

	if (
		request.userId === DEMO_USER_ID &&
		request.method !== 'GET' &&
		!DEMO_WRITE_ALLOWLIST.includes(request.url)
	) {
		return reply.status(403).send({
			error: 'Demo mode is read-only. Sign up to make changes.',
			code: 'DEMO_READ_ONLY',
		});
	}
}

declare module 'fastify' {
	interface FastifyRequest {
		userId: string;
	}
}
