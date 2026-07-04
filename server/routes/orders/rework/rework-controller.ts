import type { FastifyRequest, FastifyReply } from 'fastify';
import { createdSuccess } from '../../../utils/api-responses.js';
import { AppError } from '../../../utils/app-error.js';
import { createRework } from './rework-service.js';
import type { CreateRework } from '../contract/types.js';

export async function handleCreateRework(
	request: FastifyRequest<{ Params: { orderId: string }; Body: CreateRework }>,
	reply: FastifyReply,
) {
	const order = await createRework(
		request.userId,
		request.params.orderId,
		request.body,
	);
	if (!order) throw AppError.notFound('Order not found');

	return createdSuccess(reply, order, 'Rework created');
}
