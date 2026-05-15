import type { FastifyInstance } from 'fastify';
import { handleUpdateStore } from './store-controller.js';

export async function storeRoutes(app: FastifyInstance) {
	app.patch('/store', handleUpdateStore);
}
