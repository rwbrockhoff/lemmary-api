import type { FastifyInstance } from 'fastify';
import {
	handleSyncOrders,
	handleGetOrders,
	handleGetOrder,
} from './orders-controller.js';

export async function ordersRoutes(app: FastifyInstance) {
	app.post('/orders/sync', handleSyncOrders);
	app.get('/orders', handleGetOrders);
	app.get('/orders/:orderId', handleGetOrder);
}
