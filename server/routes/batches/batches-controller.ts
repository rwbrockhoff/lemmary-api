import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
	badRequest,
	notFound,
	internalError,
} from '../../utils/api-responses.js';
import type {
	CreateBatchRequest,
	UpdateBatchRequest,
	ToggleCompleteBody,
	UpdateCompletedQtyBody,
} from './contract/types.js';
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
		const batch = await getBatch(request.userId, request.params.batchId);

		if (!batch) return notFound(reply, 'Batch not found');
		return successResponse(reply, batch);
	} catch (error) {
		request.log.error(error, 'Failed to fetch batch');
		return internalError(reply);
	}
}

export async function handleCreateBatch(
	request: FastifyRequest<{ Body: CreateBatchRequest }>,
	reply: FastifyReply,
) {
	try {
		const { name, orderIds } = request.body;

		const batch = await createBatch(request.userId, name, orderIds);
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
		Body: UpdateBatchRequest;
	}>,
	reply: FastifyReply,
) {
	try {
		const batch = await updateBatch(
			request.userId,
			request.params.batchId,
			request.body,
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
		const deleted = await deleteBatch(request.userId, request.params.batchId);

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
		Body: ToggleCompleteBody;
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
		Body: ToggleCompleteBody;
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
		Body: ToggleCompleteBody;
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
		Body: UpdateCompletedQtyBody;
	}>,
	reply: FastifyReply,
) {
	try {
		const result = await updateOrderItemCompletedQty(
			request.userId,
			request.params.batchId,
			request.params.id,
			request.body.completedQty,
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
		Body: UpdateCompletedQtyBody;
	}>,
	reply: FastifyReply,
) {
	try {
		const result = await updateMaterialCompletedQty(
			request.userId,
			request.params.batchId,
			request.params.id,
			request.body.completedQty,
		);

		if (!result) return notFound(reply);
		return successResponse(reply, result);
	} catch (error) {
		request.log.error(error, 'Failed to update material quantity');
		return internalError(reply);
	}
}
