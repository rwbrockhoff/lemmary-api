import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, internalError } from '../../utils/api-responses.js';
import { getStoreSettings, updateLeadTime } from './settings-service.js';

export async function handleGetSettings(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const settings = await getStoreSettings(request.userId);
		return successResponse(reply, settings);
	} catch (error) {
		request.log.error(error, 'Failed to fetch settings');
		return internalError(reply);
	}
}

export async function handleUpdateLeadTime(
	request: FastifyRequest<{ Body: { leadTimeDays: number | null } }>,
	reply: FastifyReply,
) {
	try {
		const { leadTimeDays } = request.body;
		const result = await updateLeadTime(request.userId, leadTimeDays);
		return successResponse(reply, result);
	} catch (error) {
		request.log.error(error, 'Failed to update lead time');
		return internalError(reply);
	}
}
