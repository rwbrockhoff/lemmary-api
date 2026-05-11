import type { FastifyInstance } from 'fastify';
import { handleGetDashboard } from './dashboard-controller.js';

export async function dashboardRoutes(app: FastifyInstance) {
	app.get('/dashboard', handleGetDashboard);
}
