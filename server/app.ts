import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/environment.js';
import { GLOBAL_RATE_LIMIT, skipRateLimit } from './config/rate-limit.js';
import { ErrorCode } from './utils/api-responses.js';
import { authMiddleware } from './middleware/auth-middleware.js';
import { subscriptionGate } from './middleware/subscription-middleware.js';
import { registerOpenApi } from './openapi/openapi.js';
import { errorHandler } from './middleware/error-handler.js';
import { ordersRoutes } from './routes/orders/orders-routes.js';
import { reportsRoutes } from './routes/reports/reports-routes.js';
import { batchesRoutes } from './routes/batches/batches-routes.js';
import { authRoutes } from './routes/auth/auth-routes.js';
import { analyticsRoutes } from './routes/analytics/analytics-routes.js';
import { storeRoutes } from './routes/store/store-routes.js';
import { subscriptionRoutes } from './routes/subscription/subscription-routes.js';
import { shopifyRoutes } from './routes/shopify/shopify-routes.js';
import { shopifyWebhookRoutes } from './routes/shopify/shopify-webhook-routes.js';
import { stripeWebhookRoutes } from './routes/stripe/stripe-webhook-routes.js';
import { workflowRoutes } from './routes/workflow/workflow-routes.js';
import { productsRoutes } from './routes/products/products-routes.js';
import { bomRoutes } from './routes/bom/bom-routes.js';
import { materialsRoutes } from './routes/materials/materials-routes.js';
import { customersRoutes } from './routes/customers/customers-routes.js';
import { searchRoutes } from './routes/search/search-routes.js';

type BuildAppOptions = { logger?: boolean };

// Use pino-pretty for logs in dev / use raw JSON in prod
const devLoggerConfig = {
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
			translateTime: 'HH:MM:ss',
			ignore: 'pid,hostname,req.host,req.remoteAddress,req.remotePort',
		},
	},
};

export const buildApp = ({ logger = true }: BuildAppOptions = {}) => {
	const loggerConfig =
		logger && env.NODE_ENV === 'development' ? devLoggerConfig : logger;

	// Use real client IP for rate limiting when behind Railway's proxy
	const app = Fastify({ logger: loggerConfig, trustProxy: true });

	app.register(cors, {
		origin: env.FRONTEND_URL,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
	});

	app.register(cookie, {
		secret: env.COOKIE_SECRET,
	});

	// Global rate limit: auth + sync routes set stricter limits
	// Health checks and Shopify webhooks are skipped
	if (env.NODE_ENV !== 'test') {
		app.register(rateLimit, {
			...GLOBAL_RATE_LIMIT,
			allowList: skipRateLimit,
			errorResponseBuilder: (_req, context) => ({
				success: false,
				error: {
					message: `Too many requests, retry after ${context.after}`,
					code: ErrorCode.RATE_LIMIT,
				},
			}),
		});
	}

	registerOpenApi(app);

	app.setErrorHandler(errorHandler);

	app.addHook('onRequest', authMiddleware);
	// Skip billing gate in tests so suites aren't locked out
	if (env.NODE_ENV !== 'test') {
		app.addHook('onRequest', subscriptionGate);
	}

	app.get('/health', async () => {
		return { status: 'ok' };
	});

	app.register(authRoutes);
	app.register(analyticsRoutes);
	app.register(ordersRoutes);
	app.register(reportsRoutes);
	app.register(batchesRoutes);
	app.register(storeRoutes);
	app.register(subscriptionRoutes);
	app.register(shopifyRoutes);
	app.register(shopifyWebhookRoutes);
	app.register(stripeWebhookRoutes);
	app.register(workflowRoutes);
	app.register(productsRoutes);
	app.register(bomRoutes);
	app.register(materialsRoutes);
	app.register(customersRoutes);
	app.register(searchRoutes);

	return app;
};
