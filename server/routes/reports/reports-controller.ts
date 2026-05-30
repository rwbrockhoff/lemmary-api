import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { getProductionSummary, getMaterialsReport } from './reports-service.js';

export async function handleProductionSummary(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const summary = await getProductionSummary(request.userId);
	return successResponse(reply, summary);
}

export async function handleMaterialsReport(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const report = await getMaterialsReport(request.userId);
	return successResponse(reply, report);
}
