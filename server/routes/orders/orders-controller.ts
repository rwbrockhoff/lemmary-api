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
	getOrdersWithItems,
	getOrderWithItems,
	updateOrderStage,
	updateOrderNotes,
	updateOrderItemStage,
	completeAllOrderItems,
	getWorkflowBoard,
	getCompletedOrders,
} from './orders-service.js';

export async function handleSyncOrders(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const result = await syncOrders(request.userId);
		if (!result) return badRequest(reply, 'Connect a store before syncing');
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

export async function handleGetOrdersWithItems(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const orders = await getOrdersWithItems(request.userId);
		return successResponse(reply, orders);
	} catch (error) {
		request.log.error(error, 'Failed to fetch orders with items');
		return internalError(reply);
	}
}

export async function handleGetCompletedOrders(
	request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>,
	reply: FastifyReply,
) {
	try {
		const limit = Math.min(Number(request.query.limit) || 15, 50);
		const offset = Number(request.query.offset) || 0;
		const result = await getCompletedOrders(request.userId, limit, offset);
		return successResponse(reply, result);
	} catch (error) {
		request.log.error(error, 'Failed to fetch completed orders');
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

export async function handleUpdateOrderNotes(
	request: FastifyRequest<{
		Params: { orderId: string };
		Body: { notes: string };
	}>,
	reply: FastifyReply,
) {
	try {
		const { notes } = request.body;

		const order = await updateOrderNotes(
			request.userId,
			request.params.orderId,
			notes,
		);

		if (!order) return notFound(reply, 'Order not found');
		return successResponse(reply, order);
	} catch (error) {
		request.log.error(error, 'Failed to update order notes');
		return internalError(reply);
	}
}

export async function handleGetWorkflowBoard(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const board = await getWorkflowBoard(request.userId);
		return successResponse(reply, board);
	} catch (error) {
		request.log.error(error, 'Failed to fetch workflow board');
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

export async function handleCompleteAllOrderItems(
	request: FastifyRequest<{ Params: { orderId: string } }>,
	reply: FastifyReply,
) {
	try {
		const result = await completeAllOrderItems(
			request.userId,
			request.params.orderId,
		);

		if (!result) return notFound(reply, 'Order not found');
		return successResponse(reply, result);
	} catch (error) {
		request.log.error(error, 'Failed to complete all order items');
		return internalError(reply);
	}
}
