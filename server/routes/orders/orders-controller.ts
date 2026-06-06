import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import {
	getOrders,
	getOrderWithItems,
	deleteOrder,
	updateOrderStage,
	updateOrderNotes,
	updateOrderItemStage,
	completeAllOrderItems,
	getWorkflowBoard,
	getStageOrders,
} from './orders-service.js';
import { syncOrders } from './sync-service.js';
import type { GetOrdersQuery } from './contract/types.js';

export async function handleSyncOrders(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const result = await syncOrders(request.userId);
	if (!result) throw AppError.badRequest('Connect a store before syncing');
	return successResponse(reply, result, `Synced ${result.synced} orders`);
}

export async function handleGetOrders(
	request: FastifyRequest<{ Querystring: GetOrdersQuery }>,
	reply: FastifyReply,
) {
	const result = await getOrders(request.userId, request.query);
	return successResponse(reply, result);
}

export async function handleDeleteOrder(
	request: FastifyRequest<{ Params: { orderId: string } }>,
	reply: FastifyReply,
) {
	const result = await deleteOrder(request.userId, request.params.orderId);

	if (!result.ok) {
		if (result.error === 'platform')
			throw AppError.conflict('Synced orders cannot be deleted.');
		throw AppError.notFound('Order not found');
	}

	return successResponse(reply, { id: request.params.orderId });
}

export async function handleGetOrder(
	request: FastifyRequest<{ Params: { orderId: string } }>,
	reply: FastifyReply,
) {
	const order = await getOrderWithItems(request.userId, request.params.orderId);
	if (!order) throw AppError.notFound('Order not found');
	return successResponse(reply, order);
}

export async function handleUpdateOrderStage(
	request: FastifyRequest<{
		Params: { orderId: string };
		Body: { stageId: string };
	}>,
	reply: FastifyReply,
) {
	const { stageId } = request.body;
	if (!stageId) throw AppError.badRequest('Stage ID is required');

	const order = await updateOrderStage(
		request.userId,
		request.params.orderId,
		stageId,
	);

	if (!order) throw AppError.notFound('Order not found');
	return successResponse(reply, order);
}

export async function handleUpdateOrderNotes(
	request: FastifyRequest<{
		Params: { orderId: string };
		Body: { notes: string };
	}>,
	reply: FastifyReply,
) {
	const { notes } = request.body;

	const order = await updateOrderNotes(
		request.userId,
		request.params.orderId,
		notes,
	);

	if (!order) throw AppError.notFound('Order not found');
	return successResponse(reply, order);
}

export async function handleGetWorkflowBoard(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const board = await getWorkflowBoard(request.userId);
	return successResponse(reply, board);
}

export async function handleGetStageOrders(
	request: FastifyRequest<{
		Params: { stageId: string };
		Querystring: { limit: number; offset: number };
	}>,
	reply: FastifyReply,
) {
	const { stageId } = request.params;
	const { limit, offset } = request.query;

	const result = await getStageOrders(request.userId, stageId, limit, offset);
	if (!result) throw AppError.notFound('Stage not found');

	return successResponse(reply, result);
}

export async function handleUpdateOrderItemStage(
	request: FastifyRequest<{
		Params: { orderId: string; itemId: string };
		Body: { stageId: string };
	}>,
	reply: FastifyReply,
) {
	const { stageId } = request.body;
	if (!stageId) throw AppError.badRequest('Stage ID is required');

	const item = await updateOrderItemStage(
		request.userId,
		request.params.orderId,
		request.params.itemId,
		stageId,
	);

	if (!item) throw AppError.notFound('Order item not found');
	return successResponse(reply, item);
}

export async function handleCompleteAllOrderItems(
	request: FastifyRequest<{ Params: { orderId: string } }>,
	reply: FastifyReply,
) {
	const result = await completeAllOrderItems(
		request.userId,
		request.params.orderId,
	);

	if (!result) throw AppError.notFound('Order not found');
	return successResponse(reply, result);
}
