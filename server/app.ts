import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/environment.js';
import { authMiddleware } from './middleware/auth-middleware.js';
import { ordersRoutes } from './routes/orders/orders-routes.js';

export const buildApp = () => {
	const app = Fastify({ logger: true });

	app.register(cors, {
		origin: env.FRONTEND_URL,
		credentials: true,
	});

	app.addHook('onRequest', authMiddleware);

	app.get('/health', async () => {
		return { status: 'ok' };
	});

	app.register(ordersRoutes);

	return app;
};
