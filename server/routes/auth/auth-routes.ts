import type { FastifyInstance } from 'fastify';
import { env } from '../../config/environment.js';
import { handleRegister } from './auth-controller.js';
import crypto from 'node:crypto';

let activeToken: string | null = null;

export function getActiveToken() {
	return activeToken;
}

export async function authRoutes(app: FastifyInstance) {
	app.post('/auth/register', handleRegister);

	app.post<{ Body: { password: string } }>(
		'/auth/login',
		async (request, reply) => {
			const { password } = request.body;

			if (password !== env.AUTH_PASSWORD) {
				return reply.status(401).send({ error: 'Invalid password' });
			}

			activeToken = crypto.randomBytes(32).toString('hex');

			return { token: activeToken };
		},
	);
}
