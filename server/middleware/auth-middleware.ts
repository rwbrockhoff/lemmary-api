import type { FastifyRequest, FastifyReply } from 'fastify';
import { DEV_USER_ID, REFRESH_TOKEN_COOKIE } from '../config/constants.js';
import { env } from '../config/environment.js';
import { authenticateRefreshToken } from '../routes/auth/auth-service.js';
import {
	refreshCookieOptions,
	clearRefreshCookieOptions,
} from '../utils/cookies.js';

const PUBLIC_ROUTES = [
	'/auth/register',
	'/auth/login',
	'/auth/logout',
	'/auth/forgot-password',
	'/auth/reset-password',
	'/auth/status',
	'/health',
];

export async function authMiddleware(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const signedCookie = request.cookies[REFRESH_TOKEN_COOKIE];
	if (signedCookie) {
		const unsigned = request.unsignCookie(signedCookie);
		if (unsigned.valid && unsigned.value) {
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

	if (!request.userId && env.NODE_ENV === 'development') {
		request.userId = DEV_USER_ID;
	}

	if (PUBLIC_ROUTES.includes(request.url)) return;

	if (!request.userId) {
		return reply.status(401).send({ error: 'Unauthorized' });
	}
}

declare module 'fastify' {
	interface FastifyRequest {
		userId: string;
	}
}
