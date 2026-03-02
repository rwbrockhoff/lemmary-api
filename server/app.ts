import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/environment.js';
import { authMiddleware } from './middleware/auth-middleware.js';
import { ordersRoutes } from './routes/orders/orders-routes.js';
import { reportsRoutes } from './routes/reports/reports-routes.js';
import { batchesRoutes } from './routes/batches/batches-routes.js';
import { authRoutes } from './routes/auth/auth-routes.js';
import { settingsRoutes } from './routes/settings/settings-routes.js';

export const buildApp = () => {
	const app = Fastify({ logger: true });

	app.register(cors, {
		origin: env.FRONTEND_URL,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE'],
	});

	app.addHook('onRequest', authMiddleware);

	app.get('/health', async () => {
		return { status: 'ok' };
	});

	app.register(authRoutes);
	app.register(ordersRoutes);
	app.register(reportsRoutes);
	app.register(batchesRoutes);
	app.register(settingsRoutes);

	return app;
};
