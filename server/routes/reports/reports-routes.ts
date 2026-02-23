import type { FastifyInstance } from 'fastify';
import {
	handleProductionSummary,
	handleMaterialsReport,
} from './reports-controller.js';

export async function reportsRoutes(app: FastifyInstance) {
	app.get('/reports/production-summary', handleProductionSummary);
	app.get('/reports/materials', handleMaterialsReport);
}
