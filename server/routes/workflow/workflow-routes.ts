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
	DeleteItemStageQuerySchema,
} from './contract/schemas.js';
import {
	handleGetOrderStages,
	handleCreateOrderStage,
	handleUpdateOrderStage,
	handleDeleteOrderStage,
	handleReorderOrderStages,
} from './order-stages-controller.js';
import {
	handleGetItemStages,
	handleCreateItemStage,
	handleUpdateItemStage,
	handleDeleteItemStage,
	handleReorderItemStages,
} from './item-stages-controller.js';

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
		handleCreateOrderStage,
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
		handleReorderOrderStages,
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
		handleUpdateOrderStage,
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
		handleDeleteOrderStage,
	);

	r.get(
		'/workflow/item-stages',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'List item workflow stages',
				response: {
					200: successSchema(WorkflowStageListResponseSchema),
				},
			},
		},
		handleGetItemStages,
	);

	r.post(
		'/workflow/item-stages',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Create an item workflow stage',
				body: CreateWorkflowStageRequestSchema,
				response: {
					201: successSchema(WorkflowStageResponseSchema),
				},
			},
		},
		handleCreateItemStage,
	);

	r.put(
		'/workflow/item-stages/position',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Reorder item workflow stages',
				body: ReorderWorkflowStagesRequestSchema,
				response: {
					200: successSchema(ReorderWorkflowStagesResponseSchema),
				},
			},
		},
		handleReorderItemStages,
	);

	r.put(
		'/workflow/item-stages/:id',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Update an item workflow stage',
				params: StageIdParamSchema,
				body: UpdateWorkflowStageRequestSchema,
				response: {
					200: successSchema(WorkflowStageResponseSchema),
				},
			},
		},
		handleUpdateItemStage,
	);

	r.delete(
		'/workflow/item-stages/:id',
		{
			schema: {
				tags: [ApiTags.WORKFLOW_STAGES],
				summary: 'Delete an item workflow stage',
				params: StageIdParamSchema,
				querystring: DeleteItemStageQuerySchema,
				response: {
					200: successSchema(DeleteWorkflowStageResponseSchema),
				},
			},
		},
		handleDeleteItemStage,
	);
}
