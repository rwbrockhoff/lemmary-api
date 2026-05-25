import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
	conflict,
	notFound,
	internalError,
} from '../../utils/api-responses.js';
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
	try {
		const stages = await getWorkflowStages(request.userId);
		return successResponse(reply, stages);
	} catch (error) {
		request.log.error(error, 'Failed to fetch workflow stages');
		return internalError(reply);
	}
}

export async function handleCreateWorkflowStage(
	request: FastifyRequest<{ Body: CreateWorkflowStageRequest }>,
	reply: FastifyReply,
) {
	try {
		const result = await createWorkflowStage(request.userId, request.body);
		if (!result.ok) {
			return notFound(reply, 'Store not found');
		}
		return createdSuccess(reply, result.stage);
	} catch (error) {
		request.log.error(error, 'Failed to create workflow stage');
		return internalError(reply);
	}
}

export async function handleUpdateWorkflowStage(
	request: FastifyRequest<{
		Params: { id: string };
		Body: UpdateWorkflowStageRequest;
	}>,
	reply: FastifyReply,
) {
	try {
		const result = await updateWorkflowStage(
			request.userId,
			request.params.id,
			request.body,
		);

		if (!result.ok) {
			if (result.error === 'no_store') {
				return notFound(reply, 'Store not found');
			}
			return notFound(reply, 'Workflow stage not found');
		}

		return successResponse(reply, result.stage);
	} catch (error) {
		request.log.error(error, 'Failed to update workflow stage');
		return internalError(reply);
	}
}

export async function handleDeleteWorkflowStage(
	request: FastifyRequest<{ Params: { id: string } }>,
	reply: FastifyReply,
) {
	try {
		const result = await deleteWorkflowStage(request.userId, request.params.id);

		if (!result.ok) {
			if (result.error === 'no_store') {
				return notFound(reply, 'Store not found');
			}
			if (result.error === 'not_found') {
				return notFound(reply, 'Workflow stage not found');
			}
			if (result.error === 'is_default') {
				return conflict(reply, 'The default stage cannot be deleted.');
			}
			return conflict(
				reply,
				'Move existing orders out of this stage before deleting.',
			);
		}

		return successResponse(reply, { id: request.params.id });
	} catch (error) {
		request.log.error(error, 'Failed to delete workflow stage');
		return internalError(reply);
	}
}

export async function handleReorderWorkflowStages(
	request: FastifyRequest<{ Body: ReorderWorkflowStagesRequest }>,
	reply: FastifyReply,
) {
	try {
		const result = await reorderWorkflowStages(request.userId, request.body);
		if (!result.ok) {
			return notFound(reply, 'Store not found');
		}
		return successResponse(reply, { ok: true });
	} catch (error) {
		request.log.error(error, 'Failed to reorder workflow stages');
		return internalError(reply);
	}
}
