import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../../../utils/app-error.js';
import {
	generatePackingSlips,
	generateBatchPackingSlips,
} from './packing-slip-service.js';

function sendPdf(reply: FastifyReply, pdf: Buffer, filename: string) {
	return reply
		.header('Content-Type', 'application/pdf')
		.header('Content-Disposition', `attachment; filename="${filename}"`)
		.send(pdf);
}

export async function handleGetPackingSlip(
	request: FastifyRequest<{ Params: { orderId: string } }>,
	reply: FastifyReply,
) {
	const pdf = await generatePackingSlips(request.userId, [
		request.params.orderId,
	]);
	if (!pdf) throw AppError.notFound('Order not found');

	return sendPdf(reply, pdf, 'packing-slip.pdf');
}

export async function handleGetBatchPackingSlips(
	request: FastifyRequest<{ Params: { batchId: string } }>,
	reply: FastifyReply,
) {
	const pdf = await generateBatchPackingSlips(
		request.userId,
		request.params.batchId,
	);
	if (!pdf) throw AppError.notFound('No orders found for this batch');

	return sendPdf(reply, pdf, 'packing-slips.pdf');
}
