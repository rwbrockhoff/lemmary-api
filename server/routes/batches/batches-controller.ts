import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
	badRequest,
	notFound,
	internalError,
} from '../../utils/api-responses.js';
import {
	getBatches,
	getBatch,
	createBatch,
	updateBatch,
	deleteBatch,
	toggleOrderComplete,
	toggleItemComplete,
	toggleMaterialComplete,
	updateOrderItemCompletedQty,
	updateMaterialCompletedQty,
} from './batches-service.js';

export async function handleGetBatches(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		const batches = await getBatches(request.userId);
		return successResponse(reply, batches);
	} catch (error) {
		request.log.error(error, 'Failed to fetch batches');
		return internalError(reply);
	}
}

export async function handleGetBatch(
	request: FastifyRequest<{ Params: { batchId: string } }>,
	reply: FastifyReply,
) {
	try {
		const batch = await getBatch(
			request.userId,
			request.params.batchId,
		);

		if (!batch) return notFound(reply, 'Batch not found');
		return successResponse(reply, batch);
	} catch (error) {
		request.log.error(error, 'Failed to fetch batch');
		return internalError(reply);
	}
}

export async function handleCreateBatch(
	request: FastifyRequest<{
		Body: { name: string; orderIds: string[] };
	}>,
	reply: FastifyReply,
) {
	try {
		const { name, orderIds } = request.body;

		if (!name?.trim()) {
			return badRequest(reply, 'Batch name is required');
		}

		if (!orderIds?.length) {
			return badRequest(reply, 'At least one order is required');
		}

		const batch = await createBatch(
			request.userId,
			name.trim(),
			orderIds,
		);
		if (!batch) return badRequest(reply, 'Connect a store first');
		return createdSuccess(reply, batch);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === 'One or more orders not found'
		) {
			return badRequest(reply, error.message);
		}
		request.log.error(error, 'Failed to create batch');
		return internalError(reply);
	}
}

export async function handleUpdateBatch(
	request: FastifyRequest<{
		Params: { batchId: string };
		Body: { status?: string; name?: string; orderIds?: string[] };
	}>,
	reply: FastifyReply,
) {
	try {
		const { status, name, orderIds } = request.body;

		const validStatuses = ['Active', 'Up Next', 'Paused', 'Completed'];
		if (status && !validStatuses.includes(status)) {
			return badRequest(reply, `Status must be one of: ${validStatuses.join(', ')}`);
		}

		if (name !== undefined && !name.trim()) {
			return badRequest(reply, 'Batch name cannot be empty');
		}

		if (orderIds !== undefined && orderIds.length === 0) {
			return badRequest(reply, 'Batch must have at least one order');
		}

		if (!status && !name && !orderIds) {
			return badRequest(reply, 'No updates provided');
		}

		const batch = await updateBatch(
			request.userId,
			request.params.batchId,
			{ status, name, orderIds },
		);

		if (!batch) return notFound(reply, 'Batch not found');
		return successResponse(reply, batch);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === 'One or more orders not found'
		) {
			return badRequest(reply, error.message);
		}
		request.log.error(error, 'Failed to update batch');
		return internalError(reply);
	}
}

export async function handleDeleteBatch(
	request: FastifyRequest<{ Params: { batchId: string } }>,
	reply: FastifyReply,
) {
	try {
		const deleted = await deleteBatch(
			request.userId,
			request.params.batchId,
		);

		if (!deleted) return notFound(reply, 'Batch not found');
		return successResponse(reply, deleted);
	} catch (error) {
		request.log.error(error, 'Failed to delete batch');
		return internalError(reply);
	}
}

export async function handleToggleOrderComplete(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: { completed: boolean };
	}>,
	reply: FastifyReply,
) {
	try {
		const result = await toggleOrderComplete(
			request.userId,
			request.params.batchId,
			request.params.id,
			request.body.completed,
		);

		if (!result) return notFound(reply);
		return successResponse(reply, result);
	} catch (error) {
		request.log.error(error, 'Failed to update batch order');
		return internalError(reply);
	}
}

export async function handleToggleItemComplete(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: { completed: boolean };
	}>,
	reply: FastifyReply,
) {
	try {
		const result = await toggleItemComplete(
			request.userId,
			request.params.batchId,
			request.params.id,
			request.body.completed,
		);

		if (!result) return notFound(reply);
		return successResponse(reply, result);
	} catch (error) {
		request.log.error(error, 'Failed to update batch item');
		return internalError(reply);
	}
}

export async function handleToggleMaterialComplete(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: { completed: boolean };
	}>,
	reply: FastifyReply,
) {
	try {
		const result = await toggleMaterialComplete(
			request.userId,
			request.params.batchId,
			request.params.id,
			request.body.completed,
		);

		if (!result) return notFound(reply);
		return successResponse(reply, result);
	} catch (error) {
		request.log.error(error, 'Failed to update batch material');
		return internalError(reply);
	}
}

export async function handleUpdateOrderItemCompletedQty(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: { completedQty: number };
	}>,
	reply: FastifyReply,
) {
	try {
		const { completedQty } = request.body;

		if (completedQty < 0) {
			return badRequest(reply, 'Completed quantity cannot be negative');
		}

		const result = await updateOrderItemCompletedQty(
			request.userId,
			request.params.batchId,
			request.params.id,
			completedQty,
		);

		if (!result) return notFound(reply);
		return successResponse(reply, result);
	} catch (error) {
		request.log.error(error, 'Failed to update order item quantity');
		return internalError(reply);
	}
}

export async function handleUpdateMaterialCompletedQty(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: { completedQty: number };
	}>,
	reply: FastifyReply,
) {
	try {
		const { completedQty } = request.body;

		if (completedQty < 0) {
			return badRequest(reply, 'Completed quantity cannot be negative');
		}

		const result = await updateMaterialCompletedQty(
			request.userId,
			request.params.batchId,
			request.params.id,
			completedQty,
		);

		if (!result) return notFound(reply);
		return successResponse(reply, result);
	} catch (error) {
		request.log.error(error, 'Failed to update material quantity');
		return internalError(reply);
	}
}
