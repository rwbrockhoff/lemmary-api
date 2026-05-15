import type { FastifyInstance } from 'fastify';
import { handleGetOperations } from './operations/operations-controller.js';
import { handleGetPerformance } from './performance/performance-controller.js';

export async function analyticsRoutes(app: FastifyInstance) {
	app.get('/analytics/operations', handleGetOperations);
	app.get('/analytics/performance', handleGetPerformance);
}
