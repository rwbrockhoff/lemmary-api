import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	notFound,
	internalError,
} from '../../utils/api-responses.js';
import { syncOrders, getOrders, getOrderWithItems } from './orders-service.js';

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
