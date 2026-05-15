import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
	badRequest,
	conflict,
	notFound,
	internalError,
} from '../../utils/api-responses.js';
import {
	CreateWorkflowStageRequestSchema,
	UpdateWorkflowStageRequestSchema,
	ReorderWorkflowStagesRequestSchema,
} from './contract/schemas.js';
import {
	getWorkflowStages,
	createWorkflowStage,
	updateWorkflowStage,
	deleteWorkflowStage,
	reorderWorkflowStages,
} from './workflow-stages-service.js';

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
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = CreateWorkflowStageRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	try {
		const result = await createWorkflowStage(request.userId, parseResult.data);
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
	request: FastifyRequest<{ Params: { id: string } }>,
	reply: FastifyReply,
) {
	const parseResult = UpdateWorkflowStageRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	try {
		const result = await updateWorkflowStage(
			request.userId,
			request.params.id,
			parseResult.data,
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
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = ReorderWorkflowStagesRequestSchema.safeParse(
		request.body,
	);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	try {
		const result = await reorderWorkflowStages(
			request.userId,
			parseResult.data,
		);
		if (!result.ok) {
			return notFound(reply, 'Store not found');
		}
		return successResponse(reply, { ok: true });
	} catch (error) {
		request.log.error(error, 'Failed to reorder workflow stages');
		return internalError(reply);
	}
}
