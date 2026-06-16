import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	CreateWorkflowStageRequestSchema,
	UpdateWorkflowStageRequestSchema,
	ReorderWorkflowStagesRequestSchema,
	WorkflowStageResponseSchema,
	WorkflowStageListResponseSchema,
	StageIdParamSchema,
	ReorderWorkflowStagesResponseSchema,
	DeleteWorkflowStageResponseSchema,
} from './contract/schemas.js';
import {
	handleGetOrderStages,
	handleCreateWorkflowStage,
	handleUpdateWorkflowStage,
	handleDeleteWorkflowStage,
	handleReorderWorkflowStages,
} from './workflow-controller.js';

export async function workflowRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/workflow/order-stages',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'List order workflow stages',
				response: {
					200: successSchema(WorkflowStageListResponseSchema),
				},
			},
		},
		handleGetOrderStages,
	);

	r.post(
		'/workflow/order-stages',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Create an order workflow stage',
				body: CreateWorkflowStageRequestSchema,
				response: {
					201: successSchema(WorkflowStageResponseSchema),
				},
			},
		},
		handleCreateWorkflowStage,
	);

	r.put(
		'/workflow/order-stages/position',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Reorder order workflow stages',
				body: ReorderWorkflowStagesRequestSchema,
				response: {
					200: successSchema(ReorderWorkflowStagesResponseSchema),
				},
			},
		},
		handleReorderWorkflowStages,
	);

	r.put(
		'/workflow/order-stages/:id',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Update an order workflow stage',
				params: StageIdParamSchema,
				body: UpdateWorkflowStageRequestSchema,
				response: {
					200: successSchema(WorkflowStageResponseSchema),
				},
			},
		},
		handleUpdateWorkflowStage,
	);

	r.delete(
		'/workflow/order-stages/:id',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Delete an order workflow stage',
				params: StageIdParamSchema,
				response: {
					200: successSchema(DeleteWorkflowStageResponseSchema),
				},
			},
		},
		handleDeleteWorkflowStage,
	);
}
