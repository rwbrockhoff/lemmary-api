import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiTags } from '../../openapi/tags.js';
import { successSchema } from '../../openapi/schemas.js';
import {
	CreateWorkflowStageRequestSchema,
	UpdateWorkflowStageRequestSchema,
	ReorderWorkflowStagesRequestSchema,
	WorkflowStageResponseSchema,
	GetWorkflowStagesResponseSchema,
	StageIdParamSchema,
	ReorderWorkflowStagesResponseSchema,
	DeleteWorkflowStageResponseSchema,
} from './contract/schemas.js';
import {
	handleGetWorkflowStages,
	handleCreateWorkflowStage,
	handleUpdateWorkflowStage,
	handleDeleteWorkflowStage,
	handleReorderWorkflowStages,
} from './workflow-controller.js';

export async function workflowRoutes(app: FastifyInstance) {
	const r = app.withTypeProvider<ZodTypeProvider>();

	r.get(
		'/workflow/stages',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'List order and item workflow stages',
				response: {
					200: successSchema(GetWorkflowStagesResponseSchema),
				},
			},
		},
		handleGetWorkflowStages,
	);

	r.post(
		'/workflow/stages',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Create a workflow stage',
				body: CreateWorkflowStageRequestSchema,
				response: {
					201: successSchema(WorkflowStageResponseSchema),
				},
			},
		},
		handleCreateWorkflowStage,
	);

	r.put(
		'/workflow/stages/order',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Reorder workflow stages',
				body: ReorderWorkflowStagesRequestSchema,
				response: {
					200: successSchema(ReorderWorkflowStagesResponseSchema),
				},
			},
		},
		handleReorderWorkflowStages,
	);

	r.put(
		'/workflow/stages/:id',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Update a workflow stage',
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
		'/workflow/stages/:id',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Delete a workflow stage',
				params: StageIdParamSchema,
				response: {
					200: successSchema(DeleteWorkflowStageResponseSchema),
				},
			},
		},
		handleDeleteWorkflowStage,
	);
}
