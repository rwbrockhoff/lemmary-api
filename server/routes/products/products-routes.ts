import type { FastifyInstance } from 'fastify';
import {
	handleSyncProducts,
	handleGetProducts,
	handleGetProduct,
} from './products-controller.js';

export async function productsRoutes(app: FastifyInstance) {
	app.post('/products/sync', handleSyncProducts);
	app.get('/products', handleGetProducts);
	app.get('/products/:productId', handleGetProduct);
}
