import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	badRequest,
	notFound,
	internalError,
} from '../../utils/api-responses.js';
import { UpdateWorkflowStageRequestSchema } from './contract/schemas.js';
import {
	getWorkflowStages,
	updateWorkflowStage,
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

		return successResponse(reply, {
			id: result.id,
			name: result.name,
		});
	} catch (error) {
		request.log.error(error, 'Failed to update workflow stage');
		return internalError(reply);
	}
}
