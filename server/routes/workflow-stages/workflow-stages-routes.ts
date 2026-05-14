import type { FastifyInstance } from 'fastify';
import { handleUpdateWorkflowStage } from './workflow-stages-controller.js';

export async function workflowStagesRoutes(app: FastifyInstance) {
	app.put('/workflow-stages/:id', handleUpdateWorkflowStage);
}
