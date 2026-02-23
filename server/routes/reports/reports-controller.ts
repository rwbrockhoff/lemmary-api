import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, internalError } from '../../utils/api-responses.js';
import { getProductionSummary, getMaterialsReport } from './reports-service.js';

export async function handleProductionSummary(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const summary = await getProductionSummary(request.userId);
		return successResponse(reply, summary);
	} catch (error) {
		request.log.error(error, 'Failed to generate production summary');
		return internalError(reply);
	}
}

export async function handleMaterialsReport(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const report = await getMaterialsReport(request.userId);
		return successResponse(reply, report);
	} catch (error) {
		request.log.error(error, 'Failed to generate materials report');
		return internalError(reply);
	}
}
