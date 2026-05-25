import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
	validatorCompiler,
	jsonSchemaTransform,
} from 'fastify-type-provider-zod';
import { openApiMetadata } from './metadata.js';
import { createResponseSerializer } from './response-serializer.js';

export const registerOpenApi = (app: FastifyInstance) => {
	app.setValidatorCompiler(validatorCompiler);
	// Swap in our serializer so schema'd responses get soft-validated against their contract
	app.setSerializerCompiler(createResponseSerializer(app.log));

	app.register(swagger, {
		openapi: openApiMetadata,
		transform: jsonSchemaTransform,
	});

	app.register(swaggerUi, {
		routePrefix: '/api-docs',
	});
};
