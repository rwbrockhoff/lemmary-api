import type { FastifyRequest, FastifyReply } from 'fastify';
import { DEV_USER_ID } from '../config/constants.js';

export async function authMiddleware(
	request: FastifyRequest,
	_reply: FastifyReply,
) {
	request.userId = DEV_USER_ID;
}

declare module 'fastify' {
	interface FastifyRequest {
		userId: string;
	}
}
