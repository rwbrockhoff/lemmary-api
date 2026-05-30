import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	successResponse,
	createdSuccess,
} from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
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
	const batches = await getBatches(request.userId);
	return successResponse(reply, batches);
}

export async function handleGetBatch(
	request: FastifyRequest<{ Params: { batchId: string } }>,
	reply: FastifyReply,
) {
	const batch = await getBatch(request.userId, request.params.batchId);
	if (!batch) throw AppError.notFound('Batch not found');
	return successResponse(reply, batch);
}

export async function handleCreateBatch(
	request: FastifyRequest<{ Body: CreateBatchRequest }>,
	reply: FastifyReply,
) {
	const { name, orderIds } = request.body;
	const batch = await createBatch(request.userId, name, orderIds);
	if (!batch) throw AppError.badRequest('Connect a store first');
	return createdSuccess(reply, batch);
}

export async function handleUpdateBatch(
	request: FastifyRequest<{
		Params: { batchId: string };
		Body: UpdateBatchRequest;
	}>,
	reply: FastifyReply,
) {
	const batch = await updateBatch(
		request.userId,
		request.params.batchId,
		request.body,
	);

	if (!batch) throw AppError.notFound('Batch not found');
	return successResponse(reply, batch);
}

export async function handleDeleteBatch(
	request: FastifyRequest<{ Params: { batchId: string } }>,
	reply: FastifyReply,
) {
	const deleted = await deleteBatch(request.userId, request.params.batchId);
	if (!deleted) throw AppError.notFound('Batch not found');
	return successResponse(reply, deleted);
}

export async function handleToggleOrderComplete(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: ToggleCompleteBody;
	}>,
	reply: FastifyReply,
) {
	const result = await toggleOrderComplete(
		request.userId,
		request.params.batchId,
		request.params.id,
		request.body.completed,
	);

	if (!result) throw AppError.notFound();
	return successResponse(reply, result);
}

export async function handleToggleItemComplete(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: ToggleCompleteBody;
	}>,
	reply: FastifyReply,
) {
	const result = await toggleItemComplete(
		request.userId,
		request.params.batchId,
		request.params.id,
		request.body.completed,
	);

	if (!result) throw AppError.notFound();
	return successResponse(reply, result);
}

export async function handleToggleMaterialComplete(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: ToggleCompleteBody;
	}>,
	reply: FastifyReply,
) {
	const result = await toggleMaterialComplete(
		request.userId,
		request.params.batchId,
		request.params.id,
		request.body.completed,
	);

	if (!result) throw AppError.notFound();
	return successResponse(reply, result);
}

export async function handleUpdateOrderItemCompletedQty(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: UpdateCompletedQtyBody;
	}>,
	reply: FastifyReply,
) {
	const result = await updateOrderItemCompletedQty(
		request.userId,
		request.params.batchId,
		request.params.id,
		request.body.completedQty,
	);

	if (!result) throw AppError.notFound();
	return successResponse(reply, result);
}

export async function handleUpdateMaterialCompletedQty(
	request: FastifyRequest<{
		Params: { batchId: string; id: string };
		Body: UpdateCompletedQtyBody;
	}>,
	reply: FastifyReply,
) {
	const result = await updateMaterialCompletedQty(
		request.userId,
		request.params.batchId,
		request.params.id,
		request.body.completedQty,
	);

	if (!result) throw AppError.notFound();
	return successResponse(reply, result);
}
