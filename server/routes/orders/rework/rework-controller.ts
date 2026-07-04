import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
} from '../../../utils/api-responses.js';
import { AppError } from '../../../utils/app-error.js';
import { createRework, updateRework } from './rework-service.js';
import type { CreateRework, UpdateRework } from '../contract/types.js';

export async function handleCreateRework(
	request: FastifyRequest<{ Body: CreateRework }>,
	reply: FastifyReply,
) {
	const order = await createRework(request.userId, request.body);
	if (!order) throw AppError.notFound('Order not found');

	return createdSuccess(reply, order, 'Rework created');
}

export async function handleUpdateRework(
	request: FastifyRequest<{
		Params: { orderId: string };
		Body: UpdateRework;
	}>,
	reply: FastifyReply,
) {
	const order = await updateRework(
		request.userId,
		request.params.orderId,
		request.body,
	);
	if (!order) throw AppError.notFound('Rework not found');

	return successResponse(reply, order);
}
