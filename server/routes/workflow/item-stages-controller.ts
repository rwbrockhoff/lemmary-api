import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, createdSuccess } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import type {
	CreateWorkflowStageRequest,
	UpdateWorkflowStageRequest,
	ReorderWorkflowStagesRequest,
	DeleteItemStageQuery,
} from './contract/types.js';
import {
	getItemStages,
	createItemStage,
	updateItemStage,
	deleteItemStage,
	reorderItemStages,
} from './item-stages-service.js';

export async function handleGetItemStages(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const stages = await getItemStages(request.userId);
	return successResponse(reply, stages);
}

export async function handleCreateItemStage(
	request: FastifyRequest<{ Body: CreateWorkflowStageRequest }>,
	reply: FastifyReply,
) {
	const result = await createItemStage(request.userId, request.body);
	if (!result.ok) throw AppError.notFound('Store not found');
	return createdSuccess(reply, result.stage);
}

export async function handleUpdateItemStage(
	request: FastifyRequest<{
		Params: { id: string };
		Body: UpdateWorkflowStageRequest;
	}>,
	reply: FastifyReply,
) {
	const result = await updateItemStage(
		request.userId,
		request.params.id,
		request.body,
	);

	if (!result.ok) {
		if (result.error === 'no_store') throw AppError.notFound('Store not found');
		throw AppError.notFound('Workflow stage not found');
	}

	return successResponse(reply, result.stage);
}

export async function handleDeleteItemStage(
	request: FastifyRequest<{
		Params: { id: string };
		Querystring: DeleteItemStageQuery;
	}>,
	reply: FastifyReply,
) {
	const result = await deleteItemStage(
		request.userId,
		request.params.id,
		request.query.reassignStageId,
	);

	if (!result.ok) {
		if (result.error === 'no_store') throw AppError.notFound('Store not found');
		if (result.error === 'not_found')
			throw AppError.notFound('Workflow stage not found');
		if (result.error === 'is_default')
			throw AppError.conflict('The default stage cannot be deleted.');
		if (result.error === 'invalid_reassign')
			throw AppError.badRequest('Invalid stage to reassign items to.');
		if (result.error === 'has_items')
			throw AppError.conflict(
				'This stage has items in use. Reassign them to another stage to delete it.',
				{
					affectedOrders: result.affectedOrders,
					affectedCount: result.affectedCount,
					suggestedReassignStageId: result.suggestedReassignStageId,
				},
			);
	}

	return successResponse(reply, { id: request.params.id });
}

export async function handleReorderItemStages(
	request: FastifyRequest<{ Body: ReorderWorkflowStagesRequest }>,
	reply: FastifyReply,
) {
	const result = await reorderItemStages(request.userId, request.body);
	if (!result.ok) throw AppError.notFound('Store not found');
	return successResponse(reply, { ok: true });
}
