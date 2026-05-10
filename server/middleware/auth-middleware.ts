import type { FastifyRequest, FastifyReply } from 'fastify';
import { DEV_USER_ID } from '../config/constants.js';
import { env } from '../config/environment.js';

const PUBLIC_ROUTES = [
	'/auth/register',
	'/auth/login',
	'/auth/logout',
	'/auth/forgot-password',
	'/auth/reset-password',
	'/health',
];

export async function authMiddleware(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	request.userId = DEV_USER_ID;

	if (env.NODE_ENV === 'development') return;

	if (PUBLIC_ROUTES.includes(request.url)) return;

	return reply.status(401).send({ error: 'Unauthorized' });
}

declare module 'fastify' {
	interface FastifyRequest {
		userId: string;
	}
}
