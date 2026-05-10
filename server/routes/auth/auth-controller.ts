import type { FastifyRequest, FastifyReply } from 'fastify';
import {
	createdSuccess,
	badRequest,
	conflict,
	internalError,
} from '../../utils/api-responses.js';
import { RegisterRequestSchema } from './contract/schemas.js';
import { registerUser } from './auth-service.js';

export async function handleRegister(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	const parseResult = RegisterRequestSchema.safeParse(request.body);
	if (!parseResult.success) {
		return badRequest(reply, 'Invalid request', parseResult.error.format());
	}

	const { email, password } = parseResult.data;

	try {
		const result = await registerUser({ email, password });

		if (!result.success) {
			if (result.statusCode === 409) {
				return conflict(reply, result.error);
			}
			return badRequest(reply, result.error);
		}

		return createdSuccess(
			reply,
			{
				userId: result.userId,
				email,
				needsEmailConfirmation: result.needsEmailConfirmation,
			},
			'Registration successful. Please check your email to confirm your account.',
		);
	} catch (error) {
		request.log.error(error, 'Registration failed');
		return internalError(reply, 'Registration failed');
	}
}
