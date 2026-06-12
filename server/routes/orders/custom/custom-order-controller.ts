import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
} from '../../../utils/api-responses.js';
import { AppError } from '../../../utils/app-error.js';
import {
	createCustomOrder,
	updateCustomOrder,
} from './custom-order-service.js';
import type {
	CreateCustomOrder,
	UpdateCustomOrder,
} from '../contract/types.js';

export async function handleCreateCustomOrder(
	request: FastifyRequest<{ Body: CreateCustomOrder }>,
	reply: FastifyReply,
) {
	const order = await createCustomOrder(request.userId, request.body);
	if (!order)
		throw AppError.badRequest('Connect a store before creating orders');
	return createdSuccess(reply, order, 'Order created');
}

export async function handleUpdateCustomOrder(
	request: FastifyRequest<{
		Params: { orderId: string };
		Body: UpdateCustomOrder;
	}>,
	reply: FastifyReply,
) {
	const order = await updateCustomOrder(
		request.userId,
		request.params.orderId,
		request.body,
	);
	if (!order) throw AppError.notFound('Custom order not found');
	return successResponse(reply, order);
}
