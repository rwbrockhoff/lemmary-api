import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import { getStoreSettings, updateLeadTime } from './settings-service.js';

export async function handleGetSettings(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const settings = await getStoreSettings(request.userId);
	return successResponse(reply, settings);
}

export async function handleUpdateLeadTime(
	request: FastifyRequest<{ Body: { leadTimeDays: number | null } }>,
	reply: FastifyReply,
) {
	const { leadTimeDays } = request.body;
	const result = await updateLeadTime(request.userId, leadTimeDays);
	if (!result) throw AppError.badRequest('Connect a store first');
	return successResponse(reply, result);
}
