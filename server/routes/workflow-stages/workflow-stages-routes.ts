import type { FastifyInstance } from 'fastify';
import {
	handleGetWorkflowStages,
	handleCreateWorkflowStage,
	handleUpdateWorkflowStage,
	handleDeleteWorkflowStage,
	handleReorderWorkflowStages,
} from './workflow-stages-controller.js';

export async function workflowStagesRoutes(app: FastifyInstance) {
	app.get('/workflow-stages', handleGetWorkflowStages);
	app.post('/workflow-stages', handleCreateWorkflowStage);
	app.put('/workflow-stages/reorder', handleReorderWorkflowStages);
	app.put('/workflow-stages/:id', handleUpdateWorkflowStage);
	app.delete('/workflow-stages/:id', handleDeleteWorkflowStage);
}
