import type { FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../../utils/api-responses.js';
import { AppError } from '../../utils/app-error.js';
import { getCustomerByEmail } from './customers-service.js';
import type { CustomerEmailParam } from './contract/types.js';

export async function handleGetCustomer(
	request: FastifyRequest<{ Params: CustomerEmailParam }>,
	reply: FastifyReply,
) {
	const customer = await getCustomerByEmail(
		request.userId,
		request.params.email,
	);

	if (!customer) throw AppError.notFound('Customer not found');
	return successResponse(reply, customer);
}
