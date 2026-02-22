import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/environment.js';

export const buildApp = () => {
	const app = Fastify({ logger: true });

	app.register(cors, {
		origin: env.FRONTEND_URL,
		credentials: true,
	});

	app.get('/health', async () => {
		return { status: 'ok' };
	});

	return app;
};
