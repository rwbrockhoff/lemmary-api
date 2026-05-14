import type { FastifyInstance } from 'fastify';
import {
	handleGetWorkflowStages,
	handleUpdateWorkflowStage,
} from './workflow-stages-controller.js';

export async function workflowStagesRoutes(app: FastifyInstance) {
	app.get('/workflow-stages', handleGetWorkflowStages);
	app.put('/workflow-stages/:id', handleUpdateWorkflowStage);
}
