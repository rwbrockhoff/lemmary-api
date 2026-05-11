import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './config/environment.js';
import { authMiddleware } from './middleware/auth-middleware.js';
import { ordersRoutes } from './routes/orders/orders-routes.js';
import { reportsRoutes } from './routes/reports/reports-routes.js';
import { batchesRoutes } from './routes/batches/batches-routes.js';
import { authRoutes } from './routes/auth/auth-routes.js';
import { dashboardRoutes } from './routes/dashboard/dashboard-routes.js';
import { settingsRoutes } from './routes/settings/settings-routes.js';
import { productsRoutes } from './routes/products/products-routes.js';
import { bomRoutes } from './routes/bom/bom-routes.js';

export const buildApp = () => {
	const app = Fastify({ logger: true });

	app.register(cors, {
		origin: env.FRONTEND_URL,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE'],
	});

	app.register(cookie, {
		secret: env.COOKIE_SECRET,
	});

	app.addHook('onRequest', authMiddleware);

	app.get('/health', async () => {
		return { status: 'ok' };
	});

	app.register(authRoutes);
	app.register(dashboardRoutes);
	app.register(ordersRoutes);
	app.register(reportsRoutes);
	app.register(batchesRoutes);
	app.register(settingsRoutes);
	app.register(productsRoutes);
	app.register(bomRoutes);

	return app;
};
