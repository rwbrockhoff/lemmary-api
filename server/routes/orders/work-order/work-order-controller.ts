import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
} from '../../../utils/api-responses.js';
import { AppError } from '../../../utils/app-error.js';
import { createWorkOrder, updateWorkOrder } from './work-order-service.js';
import type { CreateWorkOrder, UpdateWorkOrder } from '../contract/types.js';

export async function handleCreateWorkOrder(
	request: FastifyRequest<{ Body: CreateWorkOrder }>,
	reply: FastifyReply,
) {
	const order = await createWorkOrder(request.userId, request.body);
	if (!order)
		throw AppError.badRequest('Connect a store before creating orders');
	return createdSuccess(reply, order, 'Order created');
}

export async function handleUpdateWorkOrder(
	request: FastifyRequest<{
		Params: { orderId: string };
		Body: UpdateWorkOrder;
	}>,
	reply: FastifyReply,
) {
	const order = await updateWorkOrder(
		request.userId,
		request.params.orderId,
		request.body,
	);
	if (!order) throw AppError.notFound('Work order not found');
	return successResponse(reply, order);
}
