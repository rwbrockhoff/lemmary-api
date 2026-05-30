import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
} from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import type {
	CreateWorkflowStageRequest,
	UpdateWorkflowStageRequest,
	ReorderWorkflowStagesRequest,
} from './contract/types.js';
import {
	getWorkflowStages,
	createWorkflowStage,
	updateWorkflowStage,
	deleteWorkflowStage,
	reorderWorkflowStages,
} from './workflow-service.js';

export async function handleGetWorkflowStages(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const stages = await getWorkflowStages(request.userId);
	return successResponse(reply, stages);
}

export async function handleCreateWorkflowStage(
	request: FastifyRequest<{ Body: CreateWorkflowStageRequest }>,
	reply: FastifyReply,
) {
	const result = await createWorkflowStage(request.userId, request.body);
	if (!result.ok) throw AppError.notFound('Store not found');
	return createdSuccess(reply, result.stage);
}

export async function handleUpdateWorkflowStage(
	request: FastifyRequest<{
		Params: { id: string };
		Body: UpdateWorkflowStageRequest;
	}>,
	reply: FastifyReply,
) {
	const result = await updateWorkflowStage(
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

export async function handleDeleteWorkflowStage(
	request: FastifyRequest<{ Params: { id: string } }>,
	reply: FastifyReply,
) {
	const result = await deleteWorkflowStage(request.userId, request.params.id);

	if (!result.ok) {
		if (result.error === 'no_store') throw AppError.notFound('Store not found');
		if (result.error === 'not_found')
			throw AppError.notFound('Workflow stage not found');
		if (result.error === 'is_default')
			throw AppError.conflict('The default stage cannot be deleted.');
		throw AppError.conflict(
			'Move existing orders out of this stage before deleting.',
		);
	}

	return successResponse(reply, { id: request.params.id });
}

export async function handleReorderWorkflowStages(
	request: FastifyRequest<{ Body: ReorderWorkflowStagesRequest }>,
	reply: FastifyReply,
) {
	const result = await reorderWorkflowStages(request.userId, request.body);
	if (!result.ok) throw AppError.notFound('Store not found');
	return successResponse(reply, { ok: true });
}
