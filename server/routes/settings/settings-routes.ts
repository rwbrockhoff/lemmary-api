import type { FastifyInstance } from 'fastify';
import { handleGetSettings, handleUpdateLeadTime } from './settings-controller.js';

export async function settingsRoutes(app: FastifyInstance) {
	app.get('/settings', handleGetSettings);
	app.put('/settings/lead-time', handleUpdateLeadTime);
}
