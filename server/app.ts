import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './config/environment.js';
import { authMiddleware } from './middleware/auth-middleware.js';
import { registerOpenApi } from './openapi/openapi.js';
import { errorHandler } from './middleware/error-handler.js';
import { ordersRoutes } from './routes/orders/orders-routes.js';
import { reportsRoutes } from './routes/reports/reports-routes.js';
import { batchesRoutes } from './routes/batches/batches-routes.js';
import { authRoutes } from './routes/auth/auth-routes.js';
import { analyticsRoutes } from './routes/analytics/analytics-routes.js';
import { settingsRoutes } from './routes/settings/settings-routes.js';
import { storeRoutes } from './routes/store/store-routes.js';
import { workflowRoutes } from './routes/workflow/workflow-routes.js';
import { productsRoutes } from './routes/products/products-routes.js';
import { bomRoutes } from './routes/bom/bom-routes.js';

type BuildAppOptions = { logger?: boolean };

// Use pino-pretty for logs in dev / use raw JSON in prod
const devLoggerConfig = {
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
			translateTime: 'HH:MM:ss',
			ignore: 'pid,hostname',
		},
	},
};

export const buildApp = ({ logger = true }: BuildAppOptions = {}) => {
	const loggerConfig =
		logger && env.NODE_ENV === 'development' ? devLoggerConfig : logger;

	const app = Fastify({ logger: loggerConfig });

	app.register(cors, {
		origin: env.FRONTEND_URL,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
	});

	app.register(cookie, {
		secret: env.COOKIE_SECRET,
	});

	registerOpenApi(app);

	app.setErrorHandler(errorHandler);

	app.addHook('onRequest', authMiddleware);

	app.get('/health', async () => {
		return { status: 'ok' };
	});

	app.register(authRoutes);
	app.register(analyticsRoutes);
	app.register(ordersRoutes);
	app.register(reportsRoutes);
	app.register(batchesRoutes);
	app.register(settingsRoutes);
	app.register(storeRoutes);
	app.register(workflowRoutes);
	app.register(productsRoutes);
	app.register(bomRoutes);

	return app;
};
