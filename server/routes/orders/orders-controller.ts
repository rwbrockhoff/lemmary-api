import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	notFound,
	badRequest,
	internalError,
} from '../../utils/api-responses.js';
import {
	syncOrders,
	getOrders,
	getOrderWithItems,
	getWorkflowStages,
	updateOrderStage,
	updateOrderItemStage,
} from './orders-service.js';

export async function handleSyncOrders(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const result = await syncOrders(request.userId);
		return successResponse(reply, result, `Synced ${result.synced} orders`);
	} catch (error) {
		request.log.error(error, 'Failed to sync orders');
		return internalError(reply, 'Failed to sync orders from platform');
	}
}

export async function handleGetOrders(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const orders = await getOrders(request.userId);
		return successResponse(reply, orders);
	} catch (error) {
		request.log.error(error, 'Failed to fetch orders');
		return internalError(reply);
	}
}

export async function handleGetOrder(
	request: FastifyRequest<{ Params: { orderId: string } }>,
	reply: FastifyReply,
) {
	try {
		const order = await getOrderWithItems(
			request.userId,
			request.params.orderId,
		);

		if (!order) {
			return notFound(reply, 'Order not found');
		}

		return successResponse(reply, order);
	} catch (error) {
		request.log.error(error, 'Failed to fetch order');
		return internalError(reply);
	}
}

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

export async function handleUpdateOrderStage(
	request: FastifyRequest<{
		Params: { orderId: string };
		Body: { stageId: string };
	}>,
	reply: FastifyReply,
) {
	try {
		const { stageId } = request.body;
		if (!stageId) return badRequest(reply, 'Stage ID is required');

		const order = await updateOrderStage(
			request.userId,
			request.params.orderId,
			stageId,
		);

		if (!order) return notFound(reply, 'Order not found');
		return successResponse(reply, order);
	} catch (error) {
		request.log.error(error, 'Failed to update order stage');
		return internalError(reply);
	}
}

export async function handleUpdateOrderItemStage(
	request: FastifyRequest<{
		Params: { orderId: string; itemId: string };
		Body: { stageId: string };
	}>,
	reply: FastifyReply,
) {
	try {
		const { stageId } = request.body;
		if (!stageId) return badRequest(reply, 'Stage ID is required');

		const item = await updateOrderItemStage(
			request.userId,
			request.params.orderId,
			request.params.itemId,
			stageId,
		);

		if (!item) return notFound(reply, 'Order item not found');
		return successResponse(reply, item);
	} catch (error) {
		request.log.error(error, 'Failed to update order item stage');
		return internalError(reply);
	}
}
